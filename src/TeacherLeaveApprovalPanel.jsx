import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const broadcastNotification = async (title, body, targetRole = "all", targetUser = null, redirectPage = "Inbox", skipInbox = false, fileUrl = null) => {
  const dbPayload = {
    title,
    body,
    target_role: targetRole,
    target_user: targetUser,
    redirect_page: redirectPage,
    file_url: fileUrl
  };

  let inboxError = null;
  let fcmError = null;
  let fcmData = null;
  let waError = null;
  let waSent = 0;

  // Store in database first (Inbox)
  if (!skipInbox) {
    const { error } = await supabase.from("system_notifications").insert([dbPayload]);
    if (error) {
      inboxError = error;
      console.error('Inbox notification error:', error);
    }
  }

  // Send FCM notification via Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('fcm-notification', {
      body: {
        title,
        body,
        targetRole: targetRole === "user" ? null : targetRole,
        targetUser: targetUser,
        data: {
          redirectPage,
          fileUrl: fileUrl || "",
          timestamp: new Date().toISOString()
        }
      }
    });

    if (error) {
      fcmError = error;
      console.error('FCM notification error:', error);
    } else {
      fcmData = data;
      console.log('FCM notification sent successfully:', data);
    }
  } catch (err) {
    fcmError = err;
    console.error('FCM notification error:', err);
  }

  // Send WhatsApp notification(s) based on role
  try {
    const { data: waConfig, error: waConfigErr } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("id", 1)
      .single();

    if (!waConfigErr && waConfig && waConfig.enabled && waConfig.provider !== 'none') {
      const phoneSet = new Set();

      // Look up phone numbers based on target role
      if (targetRole === "user" && targetUser) {
        // Target is a specific user (UUID or email)
        // Try teacher_profiles first
        const { data: teachers } = await supabase
          .from("teacher_profiles")
          .select("whatsapp_number")
          .or("user_id.eq." + targetUser + ",email.ilike.%" + targetUser + "%");
        if (teachers) teachers.forEach(t => { if (t.whatsapp_number) phoneSet.add(t.whatsapp_number); });

        // Try child_profiles by parent_user_id or parent_email
        const { data: parents } = await supabase
          .from("child_profiles")
          .select("whatsapp_number")
          .or("parent_user_id.eq." + targetUser + ",parent_email.ilike.%" + targetUser + "%");
        if (parents) parents.forEach(p => { if (p.whatsapp_number) phoneSet.add(p.whatsapp_number); });
      }

      if (targetRole === "parents" || targetRole === "all") {
        const { data: allParents } = await supabase
          .from("child_profiles")
          .select("whatsapp_number")
          .not("whatsapp_number", "is", null)
          .not("whatsapp_number", "eq", "");
        if (allParents) allParents.forEach(p => { if (p.whatsapp_number) phoneSet.add(p.whatsapp_number); });
      }

      if (targetRole === "teacher" || targetRole === "admin" || targetRole === "all") {
        const { data: allTeachers } = await supabase
          .from("teacher_profiles")
          .select("whatsapp_number")
          .not("whatsapp_number", "is", null)
          .not("whatsapp_number", "eq", "");
        if (allTeachers) allTeachers.forEach(t => { if (t.whatsapp_number) phoneSet.add(t.whatsapp_number); });
      }

      // Send WhatsApp message to each unique phone number
      const waMessage = title + (body ? "\n\n" + body : "");
      for (const rawPhone of phoneSet) {
        let formattedPhone = String(rawPhone).split("").filter(c => "0123456789".includes(c)).join("");
        // Convert Pakistani local numbers (03xx...) to international (923xx...)
        if (formattedPhone.length === 11 && formattedPhone.startsWith("0")) {
          formattedPhone = "92" + formattedPhone.substring(1);
        }
        if (!formattedPhone || formattedPhone.length < 10) continue;

        try {
          const { data: waResult, error: waError2 } = await supabase.functions.invoke("whatsapp-notification", {
            body: { phone: formattedPhone, message: waMessage }
          });
          if (!waError2 && waResult?.success) waSent++;
        } catch (e) {
          console.warn('WhatsApp send failed for', formattedPhone, e);
        }
      }
    }
  } catch (err) {
    waError = err;
    console.error('WhatsApp notification error:', err);
  }

  return { inboxError, fcmError, fcmData, waError, waSent };
};

export default function TeacherLeaveApprovalPanel({
  students = [],
  teacherProfiles = [],
  onShowAction,
  loadPortalData,
  portalRole,
  user,
}) {
  const [tlLeaves, setTlLeaves] = useState([]);
  const [tlLoading, setTlLoading] = useState(true);
  const [tlFilter, setTlFilter] = useState("pending");
  const [tlBadalModal, setTlBadalModal] = useState(null);
  const [tlAssignments, setTlAssignments] = useState({});
  const [tlSubmitting, setTlSubmitting] = useState(false);
  const [tlComment, setTlComment] = useState("");

  const fetchTlLeaves = () => {
    setTlLoading(true);
    supabase.from("teacher_leaves").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!error) setTlLeaves(data || []);
      setTlLoading(false);
    });
  };

  useEffect(() => { fetchTlLeaves(); }, []);

  /* Auto-restore expired leaves on load */
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    supabase.from("teacher_leave_badals").select("*").eq("active", true).lte("to_date", today).then(({ data: expired }) => {
      if (expired && expired.length > 0) {
        expired.forEach(b => {
          const sid = String(b.student_id);
          const sidNum = Number(b.student_id);
          const sidVal = isNaN(sidNum) ? sid : sidNum;
          supabase.from("child_profiles").update({ badal_teacher_id: null }).eq("student_id", sidVal).then(() => {
            supabase.from("teacher_leave_badals").update({ active: false }).eq("id", b.id);
          });
        });
      }
    });
  }, []);

  const handleTlApprove = async (lv) => {
    if (!tlComment.trim()) {
      if (onShowAction) onShowAction("error", "Please enter an admin comment before approving.");
      return;
    }
    setTlSubmitting(true);
    const myStudents = students.filter(s => String(s.muhaffiz_id) === String(lv.teacher_id) || String(s.user_id) === String(lv.teacher_id));
    if (myStudents.length === 0) {
      if (onShowAction) onShowAction("error", "No children found for this teacher.");
      setTlSubmitting(false);
      return;
    }
    const initialAssign = {};
    myStudents.forEach(s => { initialAssign[String(s.student_id)] = ""; });
    setTlAssignments(initialAssign);
    setTlBadalModal({ leave: lv, students: myStudents });
    setTlSubmitting(false);
  };

  const handleTlConfirmBadal = async () => {
    const modal = tlBadalModal;
    if (!modal) return;
    setTlSubmitting(true);
    const lv = modal.leave;
    const myStudents = modal.students;
    const assigned = myStudents.filter(s => tlAssignments[String(s.student_id)]);
    if (assigned.length === 0) {
      if (onShowAction) onShowAction("error", "Assign at least one child to a badal teacher.");
      setTlSubmitting(false);
      return;
    }
    await supabase.from("teacher_leaves").update({ status: "approved", admin_comment: tlComment }).eq("id", lv.id);
    for (const s of assigned) {
      const badalId = tlAssignments[String(s.student_id)];
      const sid = String(s.student_id);
      const sidNum = Number(s.student_id);
      const sidVal = isNaN(sidNum) ? sid : sidNum;
      const badalTeacher = teacherProfiles.find(p => p.user_id === badalId);
      const studentName = s.name || s.full_name || "";
      await supabase.from("child_profiles").update({ badal_teacher_id: badalId }).eq("student_id", sidVal);
      await supabase.from("teacher_leave_badals").insert({
        leave_id: lv.id, student_id: sidVal, student_name: studentName,
        original_teacher_id: String(lv.teacher_id), badal_teacher_id: badalId,
        badal_teacher_name: badalTeacher?.full_name || badalId,
        from_date: lv.from_date, to_date: lv.to_date, active: true
      });
      await supabase.from("badal_assignments").upsert(
        { student_id: sidVal, teacher_id: badalId, original_teacher_id: String(lv.teacher_id), status: "active" },
        { onConflict: "student_id" }
      );
      const childName = s.name || s.full_name || "a child";
      try {
        await supabase.functions.invoke('fcm-notification', {
          body: { title: "New Badal Assignment", body: `You have been assigned as badal for ${childName} during leave`, targetUser: badalId, data: { type: "badal_assignment_leave", childName } }
        });
      } catch (_) {}
    }
    broadcastNotification(
      "Leave Approved",
      `Your leave (${lv.from_date} → ${lv.to_date}) has been approved. Comment: ${tlComment}`,
      "user",
      String(lv.teacher_id),
      "Apply Leave"
    );
    setTlBadalModal(null);
    setTlAssignments({});
    setTlComment("");
    setTlSubmitting(false);
    fetchTlLeaves();
    if (loadPortalData) loadPortalData(portalRole, user);
    if (onShowAction) onShowAction("success", `Leave approved! ${assigned.length} child(ren) assigned to badal teachers.`);
  };

  const handleTlReject = async (lv) => {
    if (!tlComment.trim()) {
      if (onShowAction) onShowAction("error", "Please enter an admin comment before rejecting.");
      return;
    }
    await supabase.from("teacher_leaves").update({ status: "rejected", admin_comment: tlComment }).eq("id", lv.id);
    broadcastNotification(
      "Leave Rejected",
      `Your leave (${lv.from_date} → ${lv.to_date}) has been rejected. Comment: ${tlComment}`,
      "user",
      String(lv.teacher_id),
      "Apply Leave"
    );
    setTlComment("");
    fetchTlLeaves();
    if (onShowAction) onShowAction("success", "Leave rejected.");
  };

  const filteredTl = tlLeaves.filter(l => l.status === tlFilter);
  const teacherProfilesList = teacherProfiles || [];

  return (
    <>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '12px' }}>
        {["pending", "approved", "rejected"].map(f => (
          <button key={f} onClick={() => setTlFilter(f)}
            style={{
              padding: '8px 20px', borderRadius: '20px', border: tlFilter === f ? '2px solid var(--primary-gold)' : '1px solid #ddd',
              background: tlFilter === f ? 'var(--primary-gold)' : 'white',
              color: tlFilter === f ? 'white' : '#666', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >{f}</button>
        ))}
      </div>

      {tlLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filteredTl.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No {tlFilter} leave applications.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredTl.map(lv => {
            const teacherName = lv.teacher_name || lv.teacher_id;
            const fromD = new Date(lv.from_date);
            const toD = new Date(lv.to_date);
            const days = Math.max(0, Math.floor((toD - fromD) / 86400000) + 1);
            return (
              <div key={lv.id} className="result-card-premium" style={{ padding: '18px', borderRadius: '12px', border: '1px solid #e8e0d4', background: '#fffaf0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--deep-brown)', fontSize: '1rem' }}>{teacherName}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--soft-brown)', marginTop: '4px' }}>
                      {lv.from_date} → {lv.to_date} <span style={{ fontWeight: 600, color: 'var(--primary-gold)' }}>({days} day{days > 1 ? 's' : ''})</span>
                    </div>
                    {lv.reason && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>"{lv.reason}"</div>}
                    {lv.admin_comment && <div style={{ fontSize: '0.75rem', color: 'var(--soft-brown)', marginTop: '2px' }}>Admin: {lv.admin_comment}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {lv.status === 'pending' && (
                      <>
                        <input type="text" placeholder="Admin comment..." value={tlComment}
                          onChange={e => setTlComment(e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.8rem', width: '180px' }}
                        />
                        <button onClick={() => handleTlApprove(lv)} disabled={tlSubmitting}
                          style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #d4af37, #b8860b)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                        >Approve</button>
                        <button onClick={() => handleTlReject(lv)} disabled={tlSubmitting}
                          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#721c24', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                        >Reject</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Badal Assignment Modal */}
      {tlBadalModal && (
        <div className="celebration-overlay" onClick={() => setTlBadalModal(null)}>
          <div className="celebration-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="celebration-content" style={{ textAlign: 'left' }}>
              <h2 style={{ color: 'var(--deep-brown)', marginBottom: '12px', fontSize: '1.2rem' }}>Assign Badal Teachers</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--soft-brown)', marginBottom: '16px' }}>
                {tlBadalModal.leave.teacher_name}'s leave: {tlBadalModal.leave.from_date} → {tlBadalModal.leave.to_date}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Select a substitute teacher for each child. The child will appear in the badal teacher's portal during the leave period and auto-restore when leave ends.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {tlBadalModal.students.map(s => (
                  <div key={s.student_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', background: '#f9f6f0' }}>
                    <span style={{ flex: 1, fontWeight: 600, color: 'var(--deep-brown)', fontSize: '0.85rem' }}>{s.name || s.full_name}</span>
                    <select className="premium-select" value={tlAssignments[String(s.student_id)] || ""}
                      onChange={e => setTlAssignments(prev => ({ ...prev, [String(s.student_id)]: e.target.value }))}
                      style={{ flex: '1', minWidth: '150px', fontSize: '0.8rem' }}
                    >
                      <option value="">Select badal teacher...</option>
                      {teacherProfilesList.filter(p => String(p.user_id) !== String(tlBadalModal.leave.teacher_id)).map(p => (
                        <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setTlBadalModal(null)}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 600, cursor: 'pointer' }}
                >Cancel</button>
                <button onClick={handleTlConfirmBadal} disabled={tlSubmitting}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #d4af37, #b8860b)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >{tlSubmitting ? 'Assigning...' : 'Confirm & Approve'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
