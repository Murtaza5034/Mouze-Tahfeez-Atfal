import React, { useState } from 'react';
import { Share, PlusSquare, Bell, Check, Copy, X, Smartphone, Globe, ExternalLink, ShieldCheck } from 'lucide-react';
import { getDeviceInfo } from '../utils/deviceUtils.js';

export const IOSNotificationGuideModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const devInfo = getDeviceInfo();
  const [activeTab, setActiveTab] = useState(devInfo.isChromeIOS ? 'chrome' : 'safari');
  const [copied, setCopied] = useState(false);

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mouze-tahfeez-atfal.vercel.app';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = portalUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="notifications-panel-overlay" style={{ zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div 
        className="card-appear" 
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid rgba(197, 160, 89, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #2b1f13 0%, #463422 100%)', padding: '20px 24px', color: '#ffffff', position: 'relative' }}>
          <button 
            onClick={onClose} 
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(197, 160, 89, 0.2)', border: '1px solid rgba(197, 160, 89, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
              <Smartphone size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: '#fcfaf5', letterSpacing: '-0.01em' }}>
                Enable iOS Push Notifications
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#d0c4b4' }}>
                Quick 1-minute setup for iPhone & iPad
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher for Safari vs Chrome on iOS */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee', background: '#faf8f5', padding: '8px 16px', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('safari')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'safari' ? '#c5a059' : 'transparent',
              color: activeTab === 'safari' ? '#ffffff' : '#66594d',
              fontWeight: activeTab === 'safari' ? '600' : '500',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Globe size={15} /> Safari (Recommended)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chrome')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'chrome' ? '#c5a059' : 'transparent',
              color: activeTab === 'chrome' ? '#ffffff' : '#66594d',
              fontWeight: activeTab === 'chrome' ? '600' : '500',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <ExternalLink size={15} /> Chrome on iOS
          </button>
        </div>

        {/* Body content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, fontSize: '0.92rem', color: '#403831', lineHeight: 1.5 }}>
          
          <div style={{ background: '#fdfbf7', border: '1px solid #ebdcc5', borderRadius: '12px', padding: '12px 14px', marginBottom: '18px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <ShieldCheck size={20} style={{ color: '#c5a059', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#735f48' }}>
              <strong>Apple iOS Requirement:</strong> Apple requires web applications on iOS 16.4+ to be added to the Home Screen to deliver instant push notifications and alerts.
            </p>
          </div>

          {activeTab === 'safari' ? (
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#2b1f13', fontWeight: '700' }}>
                Follow these 4 simple steps:
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#c5a059', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.82rem', flexShrink: 0 }}>
                    1
                  </div>
                  <div>
                    <strong style={{ color: '#2b1f13' }}>Tap the Share button</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#68594d' }}>
                      At the bottom toolbar in Safari, tap the Share icon (<Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />).
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#c5a059', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.82rem', flexShrink: 0 }}>
                    2
                  </div>
                  <div>
                    <strong style={{ color: '#2b1f13' }}>Select "Add to Home Screen"</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#68594d' }}>
                      Scroll down the menu and tap <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong>Add to Home Screen</strong>, then tap <strong>Add</strong> at the top right.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#c5a059', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.82rem', flexShrink: 0 }}>
                    3
                  </div>
                  <div>
                    <strong style={{ color: '#2b1f13' }}>Open the Mauze Tahfeez App</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#68594d' }}>
                      Go to your iPhone/iPad Home Screen and tap the new <strong>Mauze Tahfeez</strong> app icon.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#c5a059', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.82rem', flexShrink: 0 }}>
                    4
                  </div>
                  <div>
                    <strong style={{ color: '#2b1f13' }}>Tap "Enable Notifications"</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#68594d' }}>
                      Inside the app, tap Allow when prompted. You will now receive all updates & leave messages instantly!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#2b1f13', fontWeight: '700' }}>
                Open in Safari to Install & Enable Alerts:
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#c5a059', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.82rem', flexShrink: 0 }}>
                    1
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#2b1f13' }}>Copy the portal link:</strong>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        style={{
                          background: copied ? '#2e7d32' : '#c5a059',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '0.84rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        {copied ? <Check size={15} /> : <Copy size={15} />}
                        {copied ? 'Link Copied!' : 'Copy Portal Link'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#c5a059', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.82rem', flexShrink: 0 }}>
                    2
                  </div>
                  <div>
                    <strong style={{ color: '#2b1f13' }}>Open Safari and Paste</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#68594d' }}>
                      Launch the <strong>Safari</strong> browser app and paste the link into the address bar.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#c5a059', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.82rem', flexShrink: 0 }}>
                    3
                  </div>
                  <div>
                    <strong style={{ color: '#2b1f13' }}>Tap Share (<Share size={13} style={{ display: 'inline' }} />) & "Add to Home Screen"</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#68594d' }}>
                      Then open the app from your Home Screen to activate notifications.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #eee', background: '#faf8f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              background: 'transparent',
              border: '1px solid #d4af37',
              color: '#936a18',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '0.86rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#2b1f13',
              color: '#ffffff',
              border: 'none',
              padding: '10px 22px',
              borderRadius: '10px',
              fontSize: '0.86rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default IOSNotificationGuideModal;
