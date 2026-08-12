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
  const [emailFieldError, setEmailFieldError] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
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
                        <div className={`input-with-icon${emailFieldError ? ' field-error' : ''}`}>
                          <Mail size={18} />
                          <input
                            id="forgot-email"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setEmailFieldError(false); setForgotError(""); }}
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
                            className="password-toggle-btn premium-eye"
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
                            className="password-toggle-btn premium-eye"
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
                      {/* Generate OTP Button */}
                      {!otpSent ? (
                        <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setOtpSending(true);
                              const code = Math.floor(100000 + Math.random() * 900000).toString();
                              setTimeout(() => {
                                setGeneratedOtp(code);
                                setOtpSent(true);
                                setForgotOtpInput("");
                                setOtpSending(false);
                              }, 600);
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #d4af37, #b8860b)',
                              color: '#fff', border: 'none', borderRadius: '10px',
                              padding: '12px 28px', fontSize: '0.92rem', fontWeight: 700,
                              cursor: 'pointer', display: 'inline-flex',
                              alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(212,175,55,0.35)'
                            }}
                            disabled={otpSending}
                          >
                            {otpSending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                            {otpSending ? "Generating..." : "Generate Verification Code"}
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* OTP Display Card */}
                          <div style={{
                            background: 'linear-gradient(135deg, #1a1200, #2a1e00)',
                            border: '2px solid #d4af37',
                            borderRadius: '14px',
                            padding: '18px 16px',
                            marginBottom: '16px',
                            textAlign: 'center',
                            boxShadow: '0 0 24px rgba(212,175,55,0.25), inset 0 1px 0 rgba(255,255,255,0.05)'
                          }}>
                            <div style={{ fontSize: '0.72rem', color: '#d4af37', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 600 }}>
                              🔐 Your Verification Code
                            </div>
                            <div style={{
                              fontSize: '2.4rem',
                              fontWeight: 800,
                              letterSpacing: '10px',
                              color: '#f0d060',
                              fontFamily: 'monospace',
                              textShadow: '0 0 20px rgba(240,208,96,0.5)',
                              padding: '4px 0'
                            }}>
                              {generatedOtp}
                            </div>
                            <div style={{ fontSize: '0.73rem', color: '#a08030', marginTop: '8px' }}>
                              Enter this code below to verify and update your password
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setOtpSending(true);
                                const code = Math.floor(100000 + Math.random() * 900000).toString();
                                setTimeout(() => {
                                  setGeneratedOtp(code);
                                  setForgotOtpInput("");
                                  setOtpSending(false);
                                }, 400);
                              }}
                              style={{
                                marginTop: '12px', background: 'transparent',
                                border: '1px solid #d4af3760', color: '#d4af37',
                                borderRadius: '6px', padding: '5px 14px',
                                fontSize: '0.73rem', cursor: 'pointer', display: 'inline-flex',
                                alignItems: 'center', gap: '5px'
                              }}
                              disabled={otpSending}
                            >
                              {otpSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Refresh Code
                            </button>
                          </div>

                          {/* OTP Input */}
                          <div className="input-group">
                            <label htmlFor="forgot-otp">Enter the Code Shown Above</label>
                            <div className="input-with-icon">
                              <ShieldCheck size={18} />
                              <input
                                id="forgot-otp"
                                type="text"
                                maxLength={6}
                                value={forgotOtpInput}
                                onChange={(e) => setForgotOtpInput(e.target.value.replace(/\D/g, ""))}
                                placeholder="Type the 6-digit code"
                                style={{ letterSpacing: '6px', fontWeight: 'bold', fontSize: '1.15rem', textAlign: 'center' }}
                                required
                                autoFocus
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
                          setEmailFieldError(true);
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
                        // Only emails that already have a registered account can
                        // reset their password — verify the account exists before
                        // advancing to the OTP step.
                        setCheckingEmail(true);
                        setForgotError("");
                        setEmailFieldError(false);
                        try {
                          const { data: emailCheck, error: checkErr } = await supabase.functions.invoke("get-user-by-email", {
                            body: { target_email: email.trim() },
                          });
                          if (checkErr) {
                            setEmailFieldError(true);
                            setForgotError("Could not verify your email. Please try again or contact support.");
                            setCheckingEmail(false);
                            return;
                          }
                          if (!emailCheck || !emailCheck.id) {
                            setEmailFieldError(true);
                            setForgotError("No account found for this email. Only registered emails can reset their password.");
                            setCheckingEmail(false);
                            return;
                          }
                        } catch (err) {
                          setEmailFieldError(true);
                          setForgotError("Could not verify your email. Please check your internet connection.");
                          setCheckingEmail(false);
                          return;
                        }
                        setCheckingEmail(false);
                        // Advance to Step 2 for OTP phone verification!
                        setForgotStep(2);
                        return;
                      }

                      // Step 2 — OTP Verify & Password Update
                      if (!otpSent) {
                        setForgotError("Please click 'Generate Verification Code' first.");
                        return;
                      }
                      if (!forgotOtpInput.trim() || forgotOtpInput.trim().length !== 6) {
                        setForgotError("Please enter the 6-digit code shown on screen.");
                        return;
                      }
                      if (forgotOtpInput.trim() !== generatedOtp) {
                        setForgotError("Incorrect code. Please type the code exactly as shown above.");
                        return;
                      }

                      setForgotLoading(true);
                      try {
                        const { error: resetErr } = await supabase.rpc("reset_user_password", {
                          target_email: email.trim(),
                          new_password: forgotNewPassword,
                        });

                        if (resetErr) {
                          setForgotError(resetErr.message || "Failed to update password. Please check your email.");
                          setForgotLoading(false);
                          return;
                        }

                        setForgotSuccess("✅ Password updated successfully! You can now log in with your new password.");
                        setPassword(forgotNewPassword);
                      } catch (err) {
                        setForgotError("An unexpected error occurred. Please try again.");
                      } finally {
                        setForgotLoading(false);
                      }
                    }}
                    disabled={forgotLoading || checkingEmail}
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={18} className="spinner" />
                        Updating Password...
                      </>
                    ) : checkingEmail ? (
                      <>
                        <Loader2 size={18} className="spinner" />
                        Checking Email...
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
