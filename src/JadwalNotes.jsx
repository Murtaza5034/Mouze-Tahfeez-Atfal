import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Send, FileText, Clock, Trash, Reply, CheckCircle } from 'lucide-react';

const normalizeText = (text) => text ? text.trim().toLowerCase() : "";

export const JadwalNotes = ({ role, studentId, studentName, teacherName, teacherId, teacherProfiles, showAction }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setHistory([]);
      return;
    }
    loadHistory();
  }, [studentId]);

  const loadHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('parent_notes')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error loading notes:", error);
    } else {
      setHistory(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('parent_notes')
      .insert([{
        student_id: studentId,
        title: title.trim(),
        body: body.trim()
      }])
      .select()
      .single();

    if (error) {
      console.error("Failed to submit note:", error);
      if (showAction) showAction("error", "Failed to submit note. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (showAction) showAction("success", "Your note has been submitted to the teacher.");
    
    setTitle('');
    setBody('');
    loadHistory();

    // Send notification to Teacher if we have their details
    if (teacherProfiles) {
      let teacher = null;
      if (teacherId) {
        teacher = teacherProfiles.find(t => t.id === teacherId || t.user_id === teacherId);
      }
      if (!teacher && teacherName) {
        teacher = teacherProfiles.find(t => normalizeText(t.full_name) === normalizeText(teacherName));
      }

      if (teacher) {
        const teacherTarget = teacher.user_id || teacher.id;
        if (teacherTarget) {
          const notifTitle = `New Parent Note: ${studentName}`;
          const notifBody = `A parent wrote a note for ${studentName}: "${title.trim()}"`;
          const notifPayload = {
            title: notifTitle,
            body: notifBody,
            target_role: "teacher",
            target_user: String(teacherTarget),
            redirect_page: `Jadwal:${studentId}`,
            created_at: new Date().toISOString()
          };

          const { error: dbErr } = await supabase.from("system_notifications").insert([notifPayload]);
          if (dbErr) {
            console.error("Failed to insert parent note notification into DB:", dbErr);
          }

          try {
            await supabase.functions.invoke('fcm-notification', {
              body: {
                title: notifTitle,
                body: notifBody,
                targetRole: "teacher",
                targetUser: String(teacherTarget),
                data: {
                  redirectPage: `Jadwal:${studentId}`,
                  timestamp: new Date().toISOString()
                }
              }
            });
          } catch (err) {
            console.error("FCM parent note notification trigger failed:", err);
          }
        }
      }
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    const { error } = await supabase.from('parent_notes').delete().eq('id', id);
    if (!error) {
      loadHistory();
      if (showAction) showAction("success", "Note deleted successfully.");
    }
  };

  const handleReplySubmit = async (noteId) => {
    const reply = replyTexts[noteId];
    if (!reply || !reply.trim()) return;

    setSubmittingReply(true);
    const { error } = await supabase
      .from('parent_notes')
      .update({
        teacher_reply: reply.trim(),
        teacher_replied_at: new Date().toISOString()
      })
      .eq('id', noteId);

    if (error) {
      console.error("Failed to submit reply:", error);
      if (showAction) showAction("error", "Failed to send reply. Please try again.");
    } else {
      if (showAction) showAction("success", "Your reply has been sent to the parent.");
      setReplyTexts(prev => ({ ...prev, [noteId]: '' }));
      setReplyingId(null);
      loadHistory();
    }
    setSubmittingReply(false);
  };

  if (!studentId) return null;

  return (
    <div className="jadwal-notes-container fade-in" style={{ marginTop: '20px', maxWidth: '850px', marginLeft: 'auto', marginRight: 'auto' }}>
      
      {role === "parent" && (
        <div className="card-appear" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <FileText size={24} style={{ color: 'var(--primary-gold)' }} />
            <h3 style={{ margin: 0, color: 'var(--deep-brown)', fontSize: '1.4rem', fontFamily: "'Cinzel', serif" }}>Write a Note to Muhaffiz</h3>
          </div>
          <p style={{ color: 'var(--soft-brown)', marginBottom: '20px', fontSize: '0.95rem' }}>
            Share updates, preparation details, or ask questions regarding your child's Quran progress.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <input 
                type="text" 
                className="premium-input" 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #dfcbb5', boxSizing: 'border-box' }}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Subject / Title (e.g. Prepared Surat Al-Mulk)"
                required
              />
            </div>
            <div>
              <textarea 
                className="premium-input" 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #dfcbb5', boxSizing: 'border-box', minHeight: '100px', resize: 'vertical' }}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your note here..."
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting || !title.trim() || !body.trim()}
              style={{
                background: 'var(--deep-brown)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 'bold',
                alignSelf: 'flex-end',
                opacity: (isSubmitting || !title.trim() || !body.trim()) ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? <Clock size={18} className="animate-spin" /> : <Send size={18} />}
              {isSubmitting ? "Submitting..." : "Submit Note"}
            </button>
          </form>
        </div>
      )}

      {history.length > 0 && (
        <div className="card-appear" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            {role === "teacher" ? <Reply size={22} style={{ color: 'var(--primary-gold)' }} /> : <FileText size={22} style={{ color: 'var(--primary-gold)' }} />}
            <h3 style={{ margin: 0, color: 'var(--deep-brown)', fontSize: '1.3rem', fontFamily: "'Cinzel', serif" }}>
              {role === "teacher" ? `Parent Notes & Replies` : "Note History"}
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {history.map(note => (
              <div key={note.id} style={{ 
                padding: '16px', 
                backgroundColor: '#fffcf8', 
                borderRadius: '12px', 
                border: '1px solid rgba(220,186,137,0.3)',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingRight: '20px' }}>
                  <h4 style={{ margin: 0, color: 'var(--deep-brown)', fontSize: '1.1rem' }}>{note.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--soft-brown)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {note.body}
                </p>

                {/* Teacher Reply Section */}
                {role === "teacher" && !note.teacher_reply && replyingId !== note.id && (
                  <button
                    onClick={() => setReplyingId(note.id)}
                    style={{
                      marginTop: '12px',
                      background: 'none',
                      border: '1px solid var(--primary-gold)',
                      color: 'var(--deep-brown)',
                      padding: '6px 16px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => { e.target.style.background = 'var(--primary-gold)'; e.target.style.color = '#fff'; }}
                    onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--deep-brown)'; }}
                  >
                    <Reply size={14} /> Quick Reply
                  </button>
                )}

                {role === "teacher" && replyingId === note.id && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#faf6ef', borderRadius: '10px', border: '1px solid rgba(212,175,55,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Reply size={14} style={{ color: 'var(--primary-gold)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--deep-brown)' }}>Your Reply</span>
                    </div>
                    <textarea
                      className="premium-input"
                      value={replyTexts[note.id] || ''}
                      onChange={e => setReplyTexts(prev => ({ ...prev, [note.id]: e.target.value }))}
                      placeholder="Type your reply to the parent..."
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dfcbb5', boxSizing: 'border-box', minHeight: '70px', resize: 'vertical', fontSize: '0.9rem' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setReplyingId(null); setReplyTexts(prev => ({ ...prev, [note.id]: '' })); }}
                        style={{ background: 'none', border: '1px solid #ccc', color: '#888', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleReplySubmit(note.id)}
                        disabled={submittingReply || !replyTexts[note.id]?.trim()}
                        style={{
                          background: 'var(--deep-brown)',
                          color: 'white',
                          border: 'none',
                          padding: '6px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: (submittingReply || !replyTexts[note.id]?.trim()) ? 0.7 : 1,
                          transition: 'all 0.2s'
                        }}
                      >
                        {submittingReply ? <Clock size={14} className="animate-spin" /> : <Send size={14} />}
                        {submittingReply ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </div>
                )}

                {note.teacher_reply && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #f7f3eb 0%, #f0e8d8 100%)',
                    borderRadius: '10px',
                    border: '1px solid rgba(212,175,55,0.25)',
                    borderLeft: '3px solid var(--primary-gold)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <CheckCircle size={14} style={{ color: 'var(--primary-gold)' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--deep-brown)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Teacher Reply
                      </span>
                      {note.teacher_replied_at && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {new Date(note.teacher_replied_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#3d2e22', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {note.teacher_reply}
                    </p>
                  </div>
                )}

                {role === "parent" && (
                  <button 
                    onClick={() => handleDelete(note.id)}
                    style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    title="Delete Note"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {history.length === 0 && role === "teacher" && (
        <div className="card-appear" style={{ background: 'white', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '2px dashed #dfcbb5', marginTop: '20px' }}>
          <FileText size={32} style={{ color: '#dfcbb5', marginBottom: '12px' }} />
          <p style={{ color: 'var(--soft-brown)', margin: 0, fontSize: '1rem' }}>No notes from parents for this student yet.</p>
          <p style={{ color: '#b8a088', marginTop: '6px', fontSize: '0.85rem' }}>When parents submit notes, they will appear here and you can reply directly.</p>
        </div>
      )}

      {history.length === 0 && role === "parent" && (
        <div className="card-appear" style={{ background: 'white', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '2px dashed #dfcbb5', marginTop: '20px' }}>
          <FileText size={32} style={{ color: '#dfcbb5', marginBottom: '12px' }} />
          <p style={{ color: 'var(--soft-brown)', margin: 0 }}>No notes submitted yet.</p>
        </div>
      )}
    </div>
  );
};
