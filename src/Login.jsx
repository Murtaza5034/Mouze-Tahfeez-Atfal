import { useState, useEffect, useRef } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, LogIn, Mail, Send, ShieldCheck, Smartphone, Users, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import lottie from "lottie-web";
// Bundled at build time so the welcome animation never depends on a network
// fetch (the deployed site's catch-all route used to serve HTML for .json
// paths on first visits, and lottie-web's XHR loader crashed on the result).
import welcomeAnimation from "./assets/Welcome.json";

import "./Login.css";

const ROLE_OPTIONS = [
  {
    id: "parents",
    label: "Parents",
    title: "Parents Portal",
    description: "Access your child's schedule, announcements, and tahfeez report.",
    icon: Users,
    gradient: "linear-gradient(135deg, #c4a54d 0%, #8a6515 100%)",
  },
  {
    id: "teacher",
    label: "Teacher",
    title: "Teacher Portal",
    description: "Open your group cards and fill child results from the tahfeez report form.",
    icon: LogIn,
    gradient: "linear-gradient(135deg, #b8941f 0%, #7a5c0e 100%)",
  },
  {
    id: "admin",
    label: "Admin",
    title: "Admin Portal",
    description: "Manage schedules, announcements, teacher attendance, and child overviews.",
    icon: ShieldCheck,
    gradient: "linear-gradient(135deg, #5a3e1b 0%, #3d2a12 100%)",
  },
];

export default function Login({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState(() => {
    return localStorage.getItem("mauze-saved-role") || "parents";
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem("mauze-saved-email") || "";
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem("mauze-saved-password") || "";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Passwords, 2: Phone & OTP
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOtpInput, setForgotOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const [buttonFeedback, setButtonFeedback] = useState(null);
  const welcomeRef = useRef(null);
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem("mauze-remember-me");
    if (saved === null) return true;
    return saved !== "false";
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("mauze-app-theme") || "default";
    document.body.setAttribute("data-theme", savedTheme);
  }, []);

  useEffect(() => {
    if (!welcomeRef.current) return;
    let anim = null;
    // animationData is bundled with the app - no network, no lottie-web XHR
    // loader (which reads responseText with responseType 'json' and throws an
    // uncaught InvalidStateError in Chrome).
    try {
      anim = lottie.loadAnimation({
        container: welcomeRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: welcomeAnimation,
      });
    } catch (e) {
      console.warn("Lottie animation failed to load:", e);
    }
    return () => {
      if (anim) anim.destroy();
    };
  }, []);

  useEffect(() => {
    if (rememberMe && email && password) {
      localStorage.setItem("mauze-saved-email", email);
      localStorage.setItem("mauze-saved-password", password);
      localStorage.setItem("mauze-saved-role", selectedRole);
      localStorage.setItem("mauze-remember-me", "true");
    } else if (!rememberMe) {
      localStorage.removeItem("mauze-saved-email");
      localStorage.removeItem("mauze-saved-password");
      localStorage.removeItem("mauze-saved-role");
      localStorage.setItem("mauze-remember-me", "false");
    }
  }, [rememberMe, email, password, selectedRole]);

  const activeRole = ROLE_OPTIONS.find((option) => option.id === selectedRole);

  function isNetworkError(err) {
    if (!err) return false;
    const msg = (err.message || err.name || '').toLowerCase();
    return msg.includes('fetch') || msg.includes('network') || msg.includes('networkerror') ||
      msg.includes('typeerror') || msg.includes('failed to fetch') || msg.includes('internet') ||
      msg.includes('abort') || msg.includes('timeout') || msg.includes('body timeout') ||
      err.name === 'TypeError' || err.name === 'AbortError' || err.code === 'NETWORK_ERROR';
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setButtonFeedback(null);

    let lastError = null;
    const maxRetries = 2;
    const timeoutMs = 10000;
    const backoffs = [1200, 2500];

    // Wrap the auth call in a timeout so a slow/hung mobile request can't block
    // the UI forever; we re-attempt with adaptive backoff on weak connections.
    const attemptAuth = () => new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ data: null, error: { name: 'AbortError', message: 'Request timed out' } });
      }, timeoutMs);
      supabase.auth.signInWithPassword({ email, password }).then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }).catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ data: null, error: err });
      });
    });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) setError(`Connection unstable. Retrying... (${attempt}/${maxRetries})`);
      const { data, error: authError } = await attemptAuth();

      if (!authError) {
        onLoginSuccess(data.user, selectedRole, rememberMe).then((result) => {
          setLoading(false);
          if (!result?.ok) {
            setError(result?.message || "This account cannot access the selected portal.");
          } else {
            setButtonFeedback("success");
          }
        });
        return;
      }

      lastError = authError;

      if (isNetworkError(authError) && attempt < maxRetries) {
        await delay(backoffs[Math.min(attempt, backoffs.length - 1)]);
        continue;
      }
      break;
    }

    setButtonFeedback("error");
    setError(isNetworkError(lastError)
      ? "Unable to connect. Please check your internet and try again."
      : lastError.message);
    setButtonFeedback(null);
    setLoading(false);
  };

  const handleRoleSwitch = (roleId) => {
    setSelectedRole(roleId);
    setError(null);
    if (!rememberMe) {
      setEmail("");
      setPassword("");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-card-accent" />

        <div className="login-logo">
          <img src="/logo.png" alt="Mauze Tahfeez" className="login-logo-img" />
        </div>

        <div className="portal-tabs-row">
          {ROLE_OPTIONS.map((role) => {
            const Icon = role.icon;
            const isActive = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                className={`portal-tab ${isActive ? "active" : ""}`}
                onClick={() => handleRoleSwitch(role.id)}
                style={isActive ? { background: role.gradient } : undefined}
              >
                <div className="portal-tab-icon">
                  <Icon size={20} />
                </div>
                <span className="portal-tab-label">{role.label}</span>
              </button>
            );
          })}
        </div>

        <div className="login-body">
          <div ref={welcomeRef} className="welcome-animation" />

          <div className="content-header">
            <h1 className="content-title">{activeRole.title}</h1>
            <p className="content-desc">{activeRole.description}</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-with-icon">
                <Mail size={18} />
                <input
                  id="email"
                  type="email"
                  placeholder={`Enter ${activeRole.label.toLowerCase()} email`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <Lock size={18} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-row">
              <label className="remember-me-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span
                  className={`premium-checkbox${rememberMe ? ' checked' : ''}`}
                  onClick={(e) => { e.preventDefault(); setRememberMe(!rememberMe); }}
                >
                  {rememberMe && <Check size={14} strokeWidth={3} />}
                </span>
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="forgot-password-link"
                onClick={() => {
                  setForgotPasswordMode(!forgotPasswordMode);
                  setForgotError("");
                  setForgotSuccess("");
                  setForgotNewPassword("");
                  setForgotConfirmPassword("");
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              className={`login-button${buttonFeedback === "success" ? " feedback-success" : ""}${buttonFeedback === "error" ? " feedback-error" : ""}`}
              disabled={loading || buttonFeedback !== null}
            >
              <span className="btn-fill-overlay" />
              <span className="btn-content">
                {loading ? (
                  <>
                    <Loader2 size={18} className="spinner" />
                    Signing in...
                  </>
                ) : buttonFeedback === "success" ? (
                  <>
                    <Check size={18} className="feedback-check" />
                    Access Granted
                  </>
                ) : buttonFeedback === "error" ? (
                  <>
                    <X size={18} className="feedback-x" />
                    Access Denied
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Open {activeRole.label} Portal
                  </>
                )}
              </span>
            </button>

          </form>

          {/* ── Forgot Password Section ── */}
          {/* ── Forgot Password Section ── */}
          {forgotPasswordMode && (
            <div className="forgot-password-section">
              <div className="forgot-divider" />

              {forgotSuccess ? (
                <div className="forgot-success">
                  <CheckCircle2 size={28} className="forgot-success-icon" style={{ color: '#22c55e' }} />
                  <h4 style={{ margin: '8px 0 4px 0', color: '#15803d' }}>Password Reset Successful!</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#4b5563' }}>{forgotSuccess}</p>
                  <button
                    type="button"
                    className="login-button"
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setForgotStep(1);
                      setForgotSuccess("");
                      setForgotNewPassword("");
                      setForgotConfirmPassword("");
                      setForgotPhone("");
                      setForgotOtpInput("");
                      setGeneratedOtp("");
                      setOtpSent(false);
                    }}
                    style={{ marginTop: '16px' }}
                  >
                    <LogIn size={16} />
                    Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h4 className="forgot-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <KeyRound size={16} /> Reset Your Password
                    </h4>
                    {forgotStep === 2 && (
                      <button
                        type="button"
                        onClick={() => { setForgotStep(1); setForgotError(""); }}
                        style={{ border: 'none', background: 'transparent', color: '#b8860b', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                      >
                        <ArrowLeft size={13} /> Edit details
                      </button>
                    )}
                  </div>

                  <p className="forgot-desc" style={{ marginBottom: '16px' }}>
                    {forgotStep === 1 
                      ? "Enter your account email and new password to start."
                      : "Verify your mobile phone number with OTP to complete password update."}
                  </p>

                  {forgotStep === 1 && (
                    <>
                      <div className="input-group">
                        <label htmlFor="forgot-email">Email Address</label>
                        <div className="input-with-icon">
                          <Mail size={18} />
                          <input
                            id="forgot-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter account email"
                            required
                          />
                        </div>
                      </div>

                      <div className="input-group">
                        <label htmlFor="forgot-new-password">New Password</label>
                        <div className="input-with-icon">
                          <Lock size={18} />
                          <input
                            id="forgot-new-password"
                            type={showForgotPassword ? "text" : "password"}
                            value={forgotNewPassword}
                            onChange={(e) => setForgotNewPassword(e.target.value)}
                            placeholder="Enter new password (min 6 chars)"
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowForgotPassword((prev) => !prev)}
                            tabIndex={-1}
                          >
                            {showForgotPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="input-group">
                        <label htmlFor="forgot-confirm-password">Confirm New Password</label>
                        <div className="input-with-icon">
                          <Lock size={18} />
                          <input
                            id="forgot-confirm-password"
                            type={showForgotConfirm ? "text" : "password"}
                            value={forgotConfirmPassword}
                            onChange={(e) => setForgotConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowForgotConfirm((prev) => !prev)}
                            tabIndex={-1}
                          >
                            {showForgotConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {forgotStep === 2 && (
                    <>
                      <div className="input-group">
                        <label htmlFor="forgot-phone">Mobile Phone Number</label>
                        <div className="input-with-icon" style={{ display: 'flex', gap: '6px' }}>
                          <Smartphone size={18} style={{ flexShrink: 0 }} />
                          <input
                            id="forgot-phone"
                            type="tel"
                            value={forgotPhone}
                            onChange={(e) => setForgotPhone(e.target.value)}
                            placeholder="Enter mobile number (e.g. +91...)"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!forgotPhone.trim() || forgotPhone.trim().length < 8) {
                                setForgotError("Please enter a valid mobile phone number.");
                                return;
                              }
                              setForgotError("");
                              setOtpSending(true);
                              const code = Math.floor(100000 + Math.random() * 900000).toString();
                              setGeneratedOtp(code);
                              setOtpSent(true);

                              // Optionally call whatsapp function
                              if (forgotPhone) {
                                supabase.functions.invoke("whatsapp-notification", {
                                  body: { phone: forgotPhone.trim(), message: `Your Mauze Tahfeez Password Reset Verification Code is: ${code}` }
                                }).catch(() => {});
                              }

                              setTimeout(() => {
                                setOtpSending(false);
                              }, 600);
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #d4af37, #b8860b)',
                              color: '#fff', border: 'none', borderRadius: '6px',
                              padding: '0 12px', fontSize: '0.78rem', fontWeight: 700,
                              cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex',
                              alignItems: 'center', gap: '4px'
                            }}
                            disabled={otpSending}
                          >
                            {otpSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            {otpSent ? "Resend OTP" : "Get OTP"}
                          </button>
                        </div>
                      </div>

                      {otpSent && (
                        <>
                          <div style={{
                            padding: '10px 12px', background: '#fefce8', border: '1px solid #fef08a',
                            borderRadius: '8px', marginBottom: '12px', fontSize: '0.8rem', color: '#854d0e'
                          }}>
                            <strong>Verification Code Sent!</strong> Your 6-digit OTP code is: <span style={{ fontWeight: 800, color: '#b8860b', letterSpacing: '1px' }}>{generatedOtp}</span>
                          </div>

                          <div className="input-group">
                            <label htmlFor="forgot-otp">Enter 6-Digit OTP</label>
                            <div className="input-with-icon">
                              <ShieldCheck size={18} />
                              <input
                                id="forgot-otp"
                                type="text"
                                maxLength={6}
                                value={forgotOtpInput}
                                onChange={(e) => setForgotOtpInput(e.target.value)}
                                placeholder="Enter 6-digit code"
                                style={{ letterSpacing: '3px', fontWeight: 'bold' }}
                                required
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {forgotError && (
                    <div className="error-message">
                      <AlertCircle size={16} />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="login-button"
                    onClick={async () => {
                      setForgotError("");

                      if (forgotStep === 1) {
                        if (!email.trim()) {
                          setForgotError("Please enter your email address.");
                          return;
                        }
                        if (!forgotNewPassword || forgotNewPassword.length < 6) {
                          setForgotError("New password must be at least 6 characters.");
                          return;
                        }
                        if (forgotNewPassword !== forgotConfirmPassword) {
                          setForgotError("New passwords do not match.");
                          return;
                        }
                        // Advance to Step 2 for OTP phone verification!
                        setForgotStep(2);
                        return;
                      }

                      // Step 2 Verification & Update
                      if (!forgotPhone.trim()) {
                        setForgotError("Please enter your mobile phone number.");
                        return;
                      }
                      if (!otpSent) {
                        setForgotError("Please click 'Get OTP' to generate your verification code.");
                        return;
                      }
                      if (!forgotOtpInput.trim() || forgotOtpInput.trim() !== generatedOtp) {
                        setForgotError("Invalid OTP code. Please check the code and try again.");
                        return;
                      }

                      setForgotLoading(true);
                      try {
                        const { data: res, error: resetErr } = await supabase.rpc("reset_user_password", {
                          target_email: email.trim(),
                          new_password: forgotNewPassword,
                        });

                        if (resetErr) {
                          setForgotError(resetErr.message || "Failed to update password. Please check your email.");
                          setForgotLoading(false);
                          return;
                        }

                        setForgotSuccess("Your password has been updated successfully! You can now log in with your new password.");
                        setPassword(forgotNewPassword);
                      } catch (err) {
                        setForgotError("An unexpected error occurred. Please try again.");
                      } finally {
                        setForgotLoading(false);
                      }
                    }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={18} className="spinner" />
                        Updating Password...
                      </>
                    ) : forgotStep === 1 ? (
                      <>
                        <ShieldCheck size={18} />
                        Continue to OTP Verification
                      </>
                    ) : (
                      <>
                        <KeyRound size={18} />
                        Verify OTP & Update Password
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setForgotStep(1);
                      setForgotError("");
                      setForgotNewPassword("");
                      setForgotConfirmPassword("");
                      setForgotPhone("");
                      setForgotOtpInput("");
                      setGeneratedOtp("");
                      setOtpSent(false);
                    }}
                  >
                    <X size={14} /> Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
