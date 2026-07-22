import { useEffect } from "react";
import { ArrowLeft, Shield, Database, Mail, Lock, RefreshCw, Users, Eye, FileText, Server, Clock, Smartphone } from "lucide-react";

const Section = ({ icon, title, children }) => (
  <div style={{
    background: '#fff',
    borderRadius: '16px',
    padding: '28px 30px',
    marginBottom: '20px',
    border: '1px solid #e8e0d4',
    boxShadow: '0 2px 12px rgba(139,109,49,0.06)',
    transition: 'box-shadow 0.2s ease',
  }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 24px rgba(139,109,49,0.12)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(139,109,49,0.06)'}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'linear-gradient(135deg, #d4af37, #b88a1d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
      }}>
        {icon}
      </div>
      <h3 style={{ margin: 0, color: '#2f2118', fontSize: '1.2rem' }}>{title}</h3>
    </div>
    <div style={{ color: '#5c4a3a', fontSize: '0.95rem', lineHeight: 1.8 }}>
      {children}
    </div>
  </div>
);

export default function PrivacyPolicy({ onBack }) {
  // Set document title for SEO / Google indexing
  useEffect(() => {
    const originalTitle = document.title;
    document.title = "Privacy Policy - Mauze Tahfeez Educational Portal";
    return () => { document.title = originalTitle; };
  }, []);

  const handleBack = onBack || (() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fcfaf5',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {/* Top Navigation */}
      <div style={{
        background: 'linear-gradient(135deg, #3d2b1f 0%, #5c3d2e 100%)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
      }}>
        <button
          onClick={handleBack}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            color: '#fff',
            cursor: 'pointer',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <img
          src="/logo.png"
          alt="Mauze Tahfeez"
          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div>
          <h1 style={{ margin: 0, color: '#d4af37', fontSize: '1.2rem', fontWeight: 700 }}>
            Mauze Tahfeez
          </h1>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
            Privacy Policy
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '30px 20px 80px' }}>
        {/* Hero */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          padding: '40px 20px',
          background: 'linear-gradient(135deg, #f8f1e6 0%, #fcf8f0 100%)',
          borderRadius: '20px',
          border: '1px solid #e8dcc8',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #d4af37, #b88a1d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(212,175,55,0.3)',
          }}>
            <Shield size={36} color="#fff" />
          </div>
          <h2 style={{ color: '#2f2118', fontSize: '1.8rem', margin: '0 0 12px' }}>
            Privacy Policy
          </h2>
          <p style={{ color: '#8a786a', fontSize: '0.95rem', margin: 0 }}>
            Last updated: July 22, 2026
          </p>
          <p style={{ color: '#6b5a4a', fontSize: '0.9rem', marginTop: '12px', lineHeight: 1.6, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Mauze Tahfeez ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our educational management portal.
          </p>
        </div>

        {/* 1. Information We Collect */}
        <Section icon={<Database size={20} />} title="1. Information We Collect">
          <p><strong>Account Information:</strong> When you register as a parent, teacher, or administrator, we collect your name, email address, phone number, and password (stored securely via Supabase Auth).</p>
          <p><strong>Student Information:</strong> We collect student names, dates of birth, gender, Marhala (grade level), group assignments, and academic progress data including weekly Quran memorization scores (Murajah, Juz Hali, Takhteet, Jadeed), attendance records, and teacher notes.</p>
          <p><strong>Parent/Guardian Information:</strong> We collect parent names, email addresses, phone numbers, and the parent-student relationship data.</p>
          <p><strong>Teacher Information:</strong> We collect teacher names, contact details, profile photos, assigned groups/students, Marhala assignments, and leave records.</p>
          <p><strong>Usage Data:</strong> We automatically collect device information (browser type, operating system), IP address, page visit timestamps, and app interactions to improve our service.</p>
          <p><strong>Push Notification Tokens:</strong> With your consent, we collect device tokens via Firebase Cloud Messaging (FCM) and OneSignal to send push notifications.</p>
          <p><strong>Communications:</strong> We store support ticket messages and system notifications sent through the portal.</p>
        </Section>

        {/* 2. How We Use Your Information */}
        <Section icon={<Eye size={20} />} title="2. How We Use Your Information">
          <p><strong>Core Operations:</strong> To manage Quran memorization progress tracking, generate academic reports, schedule classes (Jadwal), manage attendance, and facilitate parent-teacher communication.</p>
          <p><strong>Notifications:</strong> To send weekly result updates, schedule changes, announcements, and important alerts via in-app notifications and push notifications (when enabled).</p>
          <p><strong>Report Generation:</strong> To create personalized Tahfeez Progress Cards and weekly report PDFs for parents.</p>
          <p><strong>Leave Management:</strong> To process and track student and teacher leave requests.</p>
          <p><strong>Service Improvement:</strong> To analyze usage patterns, fix bugs, and enhance the platform experience.</p>
          <p><strong>Communication:</strong> To respond to support inquiries, send administrative messages, and share important updates about the platform.</p>
        </Section>

        {/* 3. Data Storage & Security */}
        <Section icon={<Server size={20} />} title="3. Data Storage & Security">
          <p><strong>Infrastructure:</strong> Your data is hosted on <strong>Supabase</strong> (PostgreSQL database with Row-Level Security), hosted on <strong>AWS</strong> (US regions). All data is encrypted in transit (TLS 1.3) and at rest (AES-256).</p>
          <p><strong>Authentication:</strong> User authentication is managed through <strong>Supabase Auth</strong> with password hashing (bcrypt). We support optional two-factor authentication (OTP) for admin accounts.</p>
          <p><strong>File Storage:</strong> Uploaded images (profile photos, report backgrounds, Marhala post photos) are stored in <strong>Supabase Storage</strong> with bucket-level access controls.</p>
          <p><strong>Push Notifications:</strong> Push notification services are powered by <strong>Firebase Cloud Messaging (FCM)</strong> and <strong>OneSignal</strong>. Device tokens are stored and managed according to their respective privacy policies.</p>
          <p><strong>Cache & Local Storage:</strong> We use browser localStorage and sessionStorage for session persistence, cached portal data, and user preferences. This data never leaves your device except through authenticated API calls.</p>
        </Section>

        {/* 4. Data Access & Sharing */}
        <Section icon={<Users size={20} />} title="4. Data Access & Sharing">
          <p><strong>Role-Based Access:</strong> Data access is strictly controlled by role:</p>
          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
            <li><strong>Parents</strong> – Can view their own children's progress, reports, schedules, attendance, and Marhala posts. They cannot see other students' data.</li>
            <li><strong>Teachers</strong> – Can view and update progress for their assigned students/groups. They can see student names and academic data but not parent contact details.</li>
            <li><strong>Administrators</strong> – Have full access to all data including student profiles, teacher records, portal settings, and system configuration.</li>
          </ul>
          <p><strong>Third-Party Services:</strong> We use the following third-party services, each with their own privacy practices:</p>
          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
            <li><strong>Supabase</strong> – Database, authentication, storage, and realtime features</li>
            <li><strong>Firebase (Google)</strong> – Cloud Messaging for push notifications</li>
            <li><strong>OneSignal</strong> – Push notification delivery and analytics</li>
            <li><strong>Vercel</strong> – Web application hosting and CDN</li>
            <li><strong>html2canvas & jsPDF</strong> – Client-side PDF report generation (data stays in browser)</li>
          </ul>
          <p><strong>No Selling of Data:</strong> We never sell, rent, or trade your personal information to third parties for marketing purposes.</p>
        </Section>

        {/* 5. Data Retention */}
        <Section icon={<Clock size={20} />} title="5. Data Retention">
          <p><strong>Active Accounts:</strong> We retain your data for as long as your account is active or as needed to provide services.</p>
          <p><strong>Archived Results:</strong> Weekly results are archived and preserved in the <strong>weekly_results_archive</strong> table for long-term academic record keeping.</p>
          <p><strong>Deleted Accounts:</strong> Upon account deletion request, we remove personal identifiable information from active databases. Archived academic records may be retained in anonymized form for statistical purposes.</p>
          <p><strong>Log Data:</strong> Server logs and analytics data are retained for up to 12 months.</p>
        </Section>

        {/* 6. Your Rights */}
        <Section icon={<Lock size={20} />} title="6. Your Rights & Choices">
          <p>You have the right to:</p>
          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
            <li><strong>Access</strong> – Request a copy of your personal data we hold.</li>
            <li><strong>Correction</strong> – Update or correct inaccurate information through the portal (Profile/Settings pages).</li>
            <li><strong>Deletion</strong> – Request deletion of your account and associated personal data.</li>
            <li><strong>Data Portability</strong> – Request your data in a structured, machine-readable format.</li>
            <li><strong>Withdraw Consent</strong> – Disable push notifications at any time via browser settings or the notification preferences page.</li>
            <li><strong>Opt-Out</strong> – Choose not to provide certain information, though this may limit functionality.</li>
          </ul>
          <p>To exercise any of these rights, please contact us at the email below. We will respond within 30 days.</p>
        </Section>

        {/* 7. Children's Privacy */}
        <Section icon={<Shield size={20} />} title="7. Children's Privacy">
          <p>Mauze Tahfeez is an educational platform used by schools and parents to track children's Quran memorization progress. We collect student information only as provided by authorized parents, teachers, and school administrators.</p>
          <p>We do not knowingly collect information from children under 13 without verifiable parental consent. The platform is designed for use by adults (parents, teachers, administrators) who input and manage student data on behalf of their children or students.</p>
          <p>If you believe a child has provided us with personal information without parental consent, please contact us immediately and we will delete such information.</p>
        </Section>

        {/* 8. Cookies & Tracking */}
        <Section icon={<RefreshCw size={20} />} title="8. Cookies & Local Storage">
          <p>We use the following browser storage mechanisms:</p>
          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
            <li><strong>localStorage</strong> – To store authentication tokens, user preferences (theme, language), and cached portal data for offline resilience.</li>
            <li><strong>sessionStorage</strong> – To temporarily store app lock state and session-specific cache.</li>
            <li><strong>Supabase Auth Session</strong> – A session cookie/token is stored to maintain your login state across page refreshes.</li>
          </ul>
          <p>We do not use cookies for tracking, advertising, or analytics across third-party websites.</p>
        </Section>

        {/* 9. Security Measures */}
        <Section icon={<Lock size={20} />} title="9. Security Measures">
          <p>We implement the following security measures to protect your data:</p>
          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
            <li><strong>Row-Level Security (RLS)</strong> – All database tables use Supabase RLS policies to ensure users can only access data they are authorized to see.</li>
            <li><strong>Encryption in Transit</strong> – All API communications are encrypted using TLS 1.3.</li>
            <li><strong>Password Security</strong> – Passwords are hashed using bcrypt and never stored in plain text.</li>
            <li><strong>OTP Verification</strong> – Admin accounts require one-time password verification for sensitive operations.</li>
            <li><strong>Session Management</strong> – Sessions expire automatically; users can manually log out from any device.</li>
            <li><strong>Access Auditing</strong> – Admin actions and login attempts are logged for security monitoring.</li>
          </ul>
        </Section>

        {/* 10. Third-Party Links */}
        <Section icon={<Smartphone size={20} />} title="10. Third-Party Links & Services">
          <p>Our portal provides access to:</p>
          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
            <li><strong>E-Learning Quran Portal</strong> (elearningquran.com) – An external platform for daily Quran entry tracking. Its use is subject to their separate privacy policy and terms.</li>
            <li><strong>WhatsApp Integration</strong> – Optional messaging features that may link to WhatsApp.</li>
          </ul>
          <p>We are not responsible for the privacy practices of these third-party services. We encourage you to review their privacy policies before use.</p>
        </Section>

        {/* 11. Changes to Policy */}
        <Section icon={<RefreshCw size={20} />} title="11. Changes to This Privacy Policy">
          <p>We may update this Privacy Policy from time to time. We will notify users of material changes through:</p>
          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
            <li>In-app notifications</li>
            <li>Email notifications (for registered accounts)</li>
            <li>A notice on the login page</li>
          </ul>
          <p>The "Last updated" date at the top of this page reflects the most recent revision. We encourage you to review this policy periodically.</p>
        </Section>

        {/* 12. Contact Us */}
        <Section icon={<Mail size={20} />} title="12. Contact Us">
          <p>If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact us:</p>
          <div style={{
            background: '#f5f0e8',
            borderRadius: '12px',
            padding: '20px',
            marginTop: '12px',
          }}>
            <p style={{ margin: '0 0 8px' }}><strong>Mauze Tahfeez Administration</strong></p>
            <p style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={16} style={{ color: '#d4af37' }} />
              Email: <a href="mailto:support@mauzetahfeez.com" style={{ color: '#5c3d2e', fontWeight: 600 }}>support@mauzetahfeez.com</a>
            </p>
            <p style={{ margin: 0, color: '#8a786a', fontSize: '0.85rem' }}>
              Response time: Within 48 business hours
            </p>
          </div>
        </Section>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          padding: '30px 20px',
          borderTop: '1px solid #e8e0d4',
          color: '#8a786a',
          fontSize: '0.85rem',
        }}>
          <p style={{ margin: '0 0 8px' }}>
            &copy; {new Date().getFullYear()} Mauze Tahfeez. All rights reserved.
          </p>
          <p style={{ margin: 0 }}>
            Rawdat Tahfeez al Atfal &mdash; Quran Memorization Management Portal
          </p>
        </div>
      </div>
    </div>
  );
}
