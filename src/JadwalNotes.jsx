import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Send, FileText, Clock, Trash } from 'lucide-react';

const normalizeText = (text) => text ? text.trim().toLowerCase() : "";

export const JadwalNotes = ({ role, studentId, studentName, teacherName, teacherProfiles, showAction }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

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
    if (teacherName && teacherProfiles) {
      const teacher = teacherProfiles.find(t => normalizeText(t.full_name) === normalizeText(teacherName));
      if (teacher && teacher.email) {
        const notifPayload = {
          title: `New Parent Note: ${studentName}`,
          body: `A parent wrote: ${title.trim()}`,
          target_role: "teacher",
          target_user: teacher.email,
          redirect_page: "Jadwal",
          created_at: new Date().toISOString()
        };
        await supabase.from("system_notifications").insert([notifPayload]);
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

  if (!studentId) return null;

  return (
    <div className="jadwal-notes-container fade-in" style={{ marginTop: '20px', maxWidth: '850px', marginLeft: 'auto', marginRight: 'auto' }}>
      
      {role === "parent" && (
        <div className="card-appear" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <FileText size={24} style={{ color: 'var(--primary-gold)' }} />
            <h3 style={{ margin: 0, color: 'var(--primary-dark)', fontSize: '1.4rem', fontFamily: "'Cinzel', serif" }}>Write a Note to Muhaffiz</h3>
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
                background: 'var(--primary-dark)',
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
          <h3 style={{ margin: '0 0 20px 0', color: 'var(--primary-dark)', fontSize: '1.3rem', fontFamily: "'Cinzel', serif" }}>
            {role === "teacher" ? `Parent Notes for ${studentName}` : "Note History"}
          </h3>
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
                  <h4 style={{ margin: 0, color: 'var(--primary-dark)', fontSize: '1.1rem' }}>{note.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--soft-brown)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {note.body}
                </p>
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
          <p style={{ color: 'var(--soft-brown)', margin: 0 }}>No notes from parents for this student.</p>
        </div>
      )}
    </div>
  );
};
