import { supabase } from "../supabaseClient";

export const DEFAULT_CMS_SETTINGS = {
  id: 1,
  form_title: "Registrations 1447-48H, Hifz Classes (Galiakot)",
  organization_name: "Tahfeez – Galiakot",
  helpline_number: "+918107925353",
  intro_countdown_seconds: 15,
  guidelines_countdown_seconds: 10,
  intro_text: `Tahfeez – Galiakot is guided by the farsighted vision of our beloved Awliyaa’ Kiraam A.S. Syedna Mohammed Burhanuddin RA envisioned that every Mumin perceives in the light of the Qur’an, and Syedna Aali Qadr Mufaddal Saifuddin TUS gave the irshaad that every Mumin household should have at least one Hafiz al-Qur’an.

In line with this divine hadaf, Tahfeez - Galiakot offers structured Hifz programmes for all age groups — Sigar, Atfal, and Kibar — nurturing a lifelong bond with Quran e Majeed.

Whether your child is just beginning their journey or you are continuing your own, this platform supports every step with structure, compassion, and the barakat of ilm and zikr.

📝 The form you are filling out will present you with options to select which programme you wish to pursue — Kibar (adults), Atfal (ages 7–15), or Sigar (ages 4–6). Choose the one that best fits your stage in this blessed journey.

PS: These hifz classes are only for Galiakot Mumineen. No accommodation provided. Outside students must arrange their own stay.`,

  guidelines_text: `• Punctuality and daily attendance are essential to maintain consistent Hifz progress.
• Dedicated daily tasmee' and revision sessions are scheduled Monday through Friday.
• Monthly Hub Raqam must be contributed on Hijri month schedule as prescribed.
• Active parental involvement and encouragement are vital for young learners in Sigar and Atfal.
• Respectful classroom demeanor and adherence to Muhaffiz guidance are strictly observed.
• Outside students must independently arrange their lodging and local logistics in Galiakot.`,

  programs_info: {
    kibar: {
      key: "Al-Kibar (Adults)",
      name: "Al-Kibar (Adults)",
      badge: "Adults Programme",
      age_group: "Adult Mumineen & Youth",
      days: "Mondays to Fridays",
      venues: "Venue 1: Burhani Masjid (Pakhti Mubarak) | Venue 2: Evan e Badri (Mohammediyah)",
      timings: "Morning (08:15 AM - 10:15 AM / 08:30 AM - 10:30 AM) & Afternoon (04:30 PM - 05:30 PM)",
      hub_raqam: "₹2,500 INR / month (Hijri month wise)",
      motto: "It’s never too late to begin your hifz journey",
      description: `Our Kibaar Hifz Programme is specially designed for adult Mumineen from all walks of life—students, housewives, professionals, businessmen, buzurgo—who wish to memorize Quran e Majeed. With dedicated morning and afternoon batches at two venues, the programme offers structured tasmee’, revision support, and regular progress tracking under experienced Muhaffizeen. Whether starting fresh or resuming their Hifz journey, students are guided to move forward with consistency and at their own pace.`,
      info_url: "https://mouze-tahfeez-atfal.vercel.app/info/kibar"
    },
    atfal: {
      key: "Al-Atfal (7 to 15 yrs old)",
      name: "Al-Atfal (7 to 15 yrs old)",
      badge: "School-Going Children",
      age_group: "7 to 15 Years Old",
      days: "Mondays to Fridays",
      venues: "Burhani Masjid (Pakhti Mubarak)",
      timings: "Afternoon 4:30 PM to 6:00 PM",
      hub_raqam: "₹2,700 INR / month (Hijri month wise)",
      motto: "The Atfal Hifz experience is a joyful blend of memorization, motivation, and meaningful connection with Qur’an e Majeed",
      description: `Our Atfal Hifz Programme is tailor-made for school-going children aged 7 to 15, with afternoon timings that align with their academic schedules. The core of the programme focuses on one-to-one tasmee’, and steady progress under the guidance of trained Muhaffizeen.
Alongside regular Hifz, we host year-round programmes including Saturday sessions combining memorization with understanding, themed events like Hifz Quizzes, Quran Treasure Hunts, Motivation Leagues, and outdoor experiences like Picnics and the year-end Fun Fair.`,
      info_url: "https://mouze-tahfeez-atfal.vercel.app/info/atfal"
    },
    sigar: {
      key: "Al-Sigar (4 to 6 yrs old)",
      name: "Al-Sigar (4 to 6 yrs old)",
      badge: "Early Childhood Hifz",
      age_group: "4 to 6 Years Old",
      days: "Mondays to Fridays",
      venues: "Pakhti Mubarak",
      timings: "Evening 5:00 PM to 6:00 PM",
      hub_raqam: "₹3,000 INR / month (Hijri month wise)",
      motto: "At SIGAR, we don’t just begin Hifz — we build memories around it",
      description: `Al-SIGAR Hifz Programme is a thoughtfully designed Hifz journey for children aged 4 to 6 years. This programme offers a gentle and joyful introduction to Hifz al-Quran in a nurturing environment that celebrates the uniqueness of every child.
With age-appropriate memorization goals, playful repetition, rhythm, storytelling, and visual aids guided by trained Muhaffizeen who understand early childhood development. Special highlights include Snow Party ❄️, Pool Party, parental modeling, and celebration of small wins!`,
      info_url: "https://mouze-tahfeez-atfal.vercel.app/info/sigar"
    }
  },

  venue_photos: [
    {
      id: "v1",
      title: "Burhani Masjid (Pakhti Mubarak) - Main Tahfeez Hall",
      description: "Serene, air-conditioned hall with individual rihals, acoustic design, and dedicated Muhaffiz circles.",
      url: "https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=1200&q=80",
      tag: "Burhani Masjid"
    },
    {
      id: "v2",
      title: "Evan e Badri (Mohammediyah) - Study Sanctuary",
      description: "Dedicated morning batch venue featuring spacious learning bays and private tasmee' areas.",
      url: "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?auto=format&fit=crop&w=1200&q=80",
      tag: "Evan e Badri"
    },
    {
      id: "v3",
      title: "Al-Sigar Interactive Activity Zone",
      description: "Vibrant and child-friendly atmosphere equipped with visual aids, audio headsets, and storyboards.",
      url: "https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1200&q=80",
      tag: "Al-Sigar Zone"
    },
    {
      id: "v4",
      title: "Quran Learning Library & Digital Progress Tracking",
      description: "Modern facility equipped with digital progress monitoring and certified Ikhtebar assessment rooms.",
      url: "https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1200&q=80",
      tag: "Facilities"
    }
  ]
};

// ============================================================================
// CMS SETTINGS ACCESS
// ============================================================================

export async function getFormSettings() {
  try {
    // Try serverless API first
    const apiRes = await fetch("/api/admission-cms").then(r => r.ok ? r.json() : null).catch(() => null);
    if (apiRes && apiRes.success && apiRes.data) {
      return {
        ...DEFAULT_CMS_SETTINGS,
        ...apiRes.data,
        programs_info: apiRes.data.programs_info || DEFAULT_CMS_SETTINGS.programs_info,
        venue_photos: Array.isArray(apiRes.data.venue_photos) && apiRes.data.venue_photos.length > 0
          ? apiRes.data.venue_photos
          : DEFAULT_CMS_SETTINGS.venue_photos
      };
    }

    const { data, error } = await supabase
      .from("admission_cms_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_CMS_SETTINGS;
    }

    return {
      ...DEFAULT_CMS_SETTINGS,
      ...data,
      programs_info: data.programs_info || DEFAULT_CMS_SETTINGS.programs_info,
      venue_photos: Array.isArray(data.venue_photos) && data.venue_photos.length > 0
        ? data.venue_photos
        : DEFAULT_CMS_SETTINGS.venue_photos
    };
  } catch (err) {
    console.warn("Using fallback CMS settings:", err);
    return DEFAULT_CMS_SETTINGS;
  }
}

export async function saveFormSettings(settings) {
  try {
    const payload = {
      id: 1,
      ...settings,
      updated_at: new Date().toISOString()
    };

    // Try serverless API first
    try {
      const res = await fetch("/api/admission-cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true, data: json.data };
      }
    } catch (_) {}

    const { data, error } = await supabase
      .from("admission_cms_settings")
      .upsert(payload, { onConflict: "id" })
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error("Error saving CMS form settings:", err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// ADMISSION SUBMISSION & LIFECYCLE MANAGEMENT
// ============================================================================

export function generateApplicationId() {
  const year = "1447";
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  const timePart = Date.now().toString().slice(-4);
  return `MT-${year}-${randomPart}${timePart}`;
}

export async function submitAdmissionApplication(formData) {
  try {
    // 1. Try serverless backend API (Firebase Admin SDK) first
    // This bypasses any client Firestore security rule restrictions for public submissions
    try {
      const apiRes = await fetch("/api/submit-admission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json.success) {
          return {
            success: true,
            applicationId: json.applicationId,
            data: json.data
          };
        }
      }
    } catch (apiErr) {
      console.warn("Serverless submission endpoint unavailable, falling back:", apiErr);
    }

    const appId = generateApplicationId();
    const timestamp = new Date().toISOString();

    const initialAuditLog = [
      {
        id: `log_${Date.now()}`,
        action: "submitted",
        from_status: "none",
        to_status: "pending",
        timestamp,
        actor: "Applicant (Online Form)",
        note: "Admission form successfully submitted online."
      }
    ];

    const applicationRecord = {
      application_id: appId,
      full_name: formData.fullName?.trim() || formData.full_name?.trim() || "",
      its_number: formData.itsNumber?.trim() || formData.its_number?.trim() || "",
      gender: formData.gender || "male",
      age: parseInt(formData.age, 10) || null,
      jamaat: formData.jamaat === "Other" ? (formData.jamaatOther?.trim() || "Other") : (formData.jamaat || "Galiakot"),
      email: formData.email?.trim()?.toLowerCase() || "",
      whatsapp_number: formData.whatsappNumber?.trim() || formData.whatsapp_number?.trim() || "",
      program: formData.program || "Al-Atfal (7 to 15 yrs old)",
      
      // Program-specific fields
      last_achieved_sanad: formData.lastAchievedSanad || null,
      venue_and_time: formData.venueAndTime || null,
      dob: formData.dob || null,
      hifz_till: formData.hifzTill || null,
      
      // Status & Lifecycle
      status: "pending", // pending | approved | waiting | rejected | exited
      enrolled_count: 0,
      exit_count: 0,
      resume_count: 0,
      timeline_audit_log: initialAuditLog,
      
      // Meta
      submitted_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { data, error } = await supabase
      .from("admission_applications")
      .insert([applicationRecord])
      .select();

    if (error) throw error;

    // Trigger WhatsApp webhook notification: Trigger 1 (Submission Pending)
    triggerWhatsappAdmissionNotification({
      trigger: "submission",
      application: applicationRecord
    }).catch(e => console.warn("WhatsApp notification background warning:", e));

    return {
      success: true,
      applicationId: appId,
      data: data ? data[0] : applicationRecord
    };
  } catch (err) {
    console.error("Error submitting admission:", err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// ADMIN APPLICATION QUERIES (RBAC AWARE)
// ============================================================================

export async function fetchAdmissionApplications({ role = "all", program = "all", status = "all", search = "" } = {}) {
  try {
    let query = supabase
      .from("admission_applications")
      .select("*")
      .order("created_at", { ascending: false });

    // RBAC filtering
    if (role === "kibar") {
      query = query.eq("program", "Al-Kibar (Adults)");
    } else if (role === "atfal") {
      // Atfal admin dashboard can view Atfal applications, or Sigar via general tab
      if (program === "sigar") {
        query = query.eq("program", "Al-Sigar (4 to 6 yrs old)");
      } else if (program === "atfal") {
        query = query.eq("program", "Al-Atfal (7 to 15 yrs old)");
      } else {
        query = query.in("program", ["Al-Atfal (7 to 15 yrs old)", "Al-Sigar (4 to 6 yrs old)"]);
      }
    } else if (program && program !== "all") {
      query = query.eq("program", program);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];

    // Client-side text search if query provided
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(item =>
        (item.full_name && item.full_name.toLowerCase().includes(q)) ||
        (item.its_number && item.its_number.includes(q)) ||
        (item.email && item.email.toLowerCase().includes(q)) ||
        (item.whatsapp_number && item.whatsapp_number.includes(q)) ||
        (item.application_id && item.application_id.toLowerCase().includes(q)) ||
        (item.jamaat && item.jamaat.toLowerCase().includes(q))
      );
    }

    return { success: true, data: results };
  } catch (err) {
    console.error("Error fetching applications:", err);
    return { success: false, data: [], error: err.message };
  }
}

// ============================================================================
// STATUS ACTIONS & LIFECYCLE (APPROVED, REJECT, WAITING, EXIT, RESUME)
// ============================================================================

export async function updateAdmissionStatus({
  applicationId,
  newStatus,
  adminUser = "Admin",
  adminNote = ""
}) {
  try {
    // 1. Fetch current application record
    const { data: current, error: fetchErr } = await supabase
      .from("admission_applications")
      .select("*")
      .eq("application_id", applicationId)
      .single();

    if (fetchErr || !current) throw new Error("Application not found");

    const prevStatus = current.status;
    const timestamp = new Date().toISOString();
    const existingLogs = Array.isArray(current.timeline_audit_log) ? current.timeline_audit_log : [];

    let newEnrolledCount = current.enrolled_count || 0;
    if (newStatus === "approved" && prevStatus !== "approved") {
      newEnrolledCount += 1;
    }

    const newLogEntry = {
      id: `log_${Date.now()}`,
      action: newStatus,
      from_status: prevStatus,
      to_status: newStatus,
      timestamp,
      actor: adminUser,
      note: adminNote || `Status updated from ${prevStatus} to ${newStatus}`
    };

    const updatedRecord = {
      status: newStatus,
      enrolled_count: newEnrolledCount,
      timeline_audit_log: [newLogEntry, ...existingLogs],
      updated_at: timestamp,
      last_action_by: adminUser
    };

    const { data, error: updateErr } = await supabase
      .from("admission_applications")
      .update(updatedRecord)
      .eq("application_id", applicationId)
      .select();

    if (updateErr) throw updateErr;

    // Trigger WhatsApp notification for Status Action
    if (newStatus === "approved") {
      triggerWhatsappAdmissionNotification({
        trigger: "approved",
        application: { ...current, ...updatedRecord }
      }).catch(console.warn);
    } else if (newStatus === "rejected") {
      triggerWhatsappAdmissionNotification({
        trigger: "rejected",
        application: { ...current, ...updatedRecord }
      }).catch(console.warn);
    } else if (newStatus === "waiting") {
      triggerWhatsappAdmissionNotification({
        trigger: "waiting",
        application: { ...current, ...updatedRecord }
      }).catch(console.warn);
    }

    return { success: true, data: data ? data[0] : updatedRecord };
  } catch (err) {
    console.error("Error updating admission status:", err);
    return { success: false, error: err.message };
  }
}

// The Exit System
export async function exitAdmissionUser({
  applicationId,
  adminUser = "Admin",
  exitReason = "Course exited by student/admin"
}) {
  try {
    const { data: current, error: fetchErr } = await supabase
      .from("admission_applications")
      .select("*")
      .eq("application_id", applicationId)
      .single();

    if (fetchErr || !current) throw new Error("Application not found");

    const timestamp = new Date().toISOString();
    const existingLogs = Array.isArray(current.timeline_audit_log) ? current.timeline_audit_log : [];
    const newExitCount = (current.exit_count || 0) + 1;

    const newLogEntry = {
      id: `log_${Date.now()}`,
      action: "exited",
      from_status: current.status,
      to_status: "exited",
      timestamp,
      actor: adminUser,
      note: exitReason
    };

    const updatedRecord = {
      status: "exited",
      exit_count: newExitCount,
      timeline_audit_log: [newLogEntry, ...existingLogs],
      updated_at: timestamp,
      last_action_by: adminUser
    };

    const { data, error: updateErr } = await supabase
      .from("admission_applications")
      .update(updatedRecord)
      .eq("application_id", applicationId)
      .select();

    if (updateErr) throw updateErr;
    return { success: true, data: data ? data[0] : updatedRecord };
  } catch (err) {
    console.error("Error exiting user:", err);
    return { success: false, error: err.message };
  }
}

// The Resume System
export async function resumeAdmissionUser({
  applicationId,
  adminUser = "Admin",
  resumeNote = "Resumed active enrollment"
}) {
  try {
    const { data: current, error: fetchErr } = await supabase
      .from("admission_applications")
      .select("*")
      .eq("application_id", applicationId)
      .single();

    if (fetchErr || !current) throw new Error("Application not found");

    const timestamp = new Date().toISOString();
    const existingLogs = Array.isArray(current.timeline_audit_log) ? current.timeline_audit_log : [];
    const newResumeCount = (current.resume_count || 0) + 1;

    const newLogEntry = {
      id: `log_${Date.now()}`,
      action: "resumed",
      from_status: current.status,
      to_status: "approved",
      timestamp,
      actor: adminUser,
      note: resumeNote
    };

    const updatedRecord = {
      status: "approved",
      resume_count: newResumeCount,
      timeline_audit_log: [newLogEntry, ...existingLogs],
      updated_at: timestamp,
      last_action_by: adminUser
    };

    const { data, error: updateErr } = await supabase
      .from("admission_applications")
      .update(updatedRecord)
      .eq("application_id", applicationId)
      .select();

    if (updateErr) throw updateErr;

    // Trigger Approval WhatsApp message on resume
    triggerWhatsappAdmissionNotification({
      trigger: "approved",
      application: { ...current, ...updatedRecord }
    }).catch(console.warn);

    return { success: true, data: data ? data[0] : updatedRecord };
  } catch (err) {
    console.error("Error resuming user:", err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// WHATSAPP NOTIFICATION TRIGGER DISPATCHER
// ============================================================================

export async function triggerWhatsappAdmissionNotification({ trigger, application }) {
  try {
    const response = await fetch("/api/whatsapp-admission", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        trigger, // 'submission' | 'approved' | 'rejected' | 'waiting'
        application
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      console.warn("WhatsApp admission notification response not ok:", errJson);
      return { success: false, error: errJson.message || response.statusText };
    }

    const result = await response.json();
    return { success: true, result };
  } catch (err) {
    console.warn("WhatsApp notification API call fallback warning:", err);
    return { success: false, error: err.message };
  }
}
