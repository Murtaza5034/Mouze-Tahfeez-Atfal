import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Fingerprint, KeyRound, Loader2, Lock, LogIn, Mail, ShieldCheck, Users, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import lottie from "lottie-web";
import { isBiometricAvailable, setBiometricCredentials, getBiometricCredentials, isBiometricEnabled, removeBiometricCredentials } from "./hooks/useBiometric";
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

export default function Login({ onLoginSuccess, initialUser = null, initialRole = "parents", onCancel = null }) {
  const [selectedRole, setSelectedRole] = useState(() => {
    if (initialUser && initialRole) return initialRole;
    return localStorage.getItem("mauze-saved-role") || "parents";
  });
  const [email, setEmail] = useState(() => {
    if (initialUser?.email) return initialUser.email;
    return localStorage.getItem("mauze-saved-email") || "";
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem("mauze-saved-password") || "";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotCurrentPassword, setForgotCurrentPassword] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [showForgotCurrent, setShowForgotCurrent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const welcomeRef = useRef(null);
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem("mauze-remember-me");
    if (saved === null) return true;
    return saved !== "false";
  });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricReady, setBiometricReady] = useState(isBiometricEnabled());
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Secret key flow states
  const [step, setStep] = useState(initialUser ? "otp" : "login");
  const [tempUser, setTempUser] = useState(initialUser || null);
  const [secretKey, setSecretKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyTimer, setKeyTimer] = useState(60);
  const [keyError, setKeyError] = useState("");

  const generateAlphanumericOtp = (length = 6) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Easily readable uppercase alphanumeric
    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Auto-generate secret key when OTP step mounts
  useEffect(() => {
    if (step !== "otp") return;
    setSecretKey(generateAlphanumericOtp(6));
    setKeyInput("");
    setKeyError("");
    setKeyTimer(60);
  }, [step]);

  // 1-minute countdown timer — auto-expires and cancels
  useEffect(() => {
    if (step !== "otp") return;
    if (keyTimer <= 0) {
      setSecretKey("");
      setKeyInput("");
      setKeyError("");
      setStep("login");
      setTempUser(null);
      setError(null);
      supabase.auth.signOut().catch(() => {});
      if (onCancel) onCancel();
      return;
    }
    const interval = setInterval(() => {
      setKeyTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [keyTimer, step]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("mauze-app-theme") || "default";
    document.body.setAttribute("data-theme", savedTheme);
  }, []);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  useEffect(() => {
    if (step !== "login") return; // Only load animation in login step
    if (!welcomeRef.current) return;
    let anim = null;
    const timer = setTimeout(() => {
      try {
        anim = lottie.loadAnimation({
          container: welcomeRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: "/Welcome.json",
        });
      } catch (e) {
        console.warn("Lottie animation failed to load:", e);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      if (anim) anim.destroy();
    };
  }, [step]);

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

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // For admin login, set a flag BEFORE authenticating so the App.jsx auth
    // listener knows to pause auto-resolve and let the OTP modal appear.
    if (selectedRole === "admin") {
      sessionStorage.setItem("mauze-admin-otp-flow", "true");
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      if (selectedRole === "admin") {
        sessionStorage.removeItem("mauze-admin-otp-flow");
      }
      return;
    }

    if (selectedRole === "admin") {
      // Show OTP screen immediately after successful authentication.
      // Full portal authorization (portal_access table + metadata roles)
      // happens in onLoginSuccess after OTP verification.
      setTempUser(data.user);
      setStep("otp");
      setPassword("");
      setLoading(false);
      return;
    }

    const result = await onLoginSuccess(data.user, selectedRole, rememberMe);

    if (!result?.ok) {
      setError(result?.message || "This account cannot access the selected portal.");
      setLoading(false);
      return;
    }

    if (biometricAvailable && !isBiometricEnabled()) {
      try {
        await setBiometricCredentials(email, password);
        setBiometricReady(true);
      } catch {}
    }
  };

  const handleVerifySecretKey = async (event) => {
    if (event) event.preventDefault();
    setKeyLoading(true);
    setKeyError("");

    if (!keyInput.trim()) {
      setKeyError("Please enter the secret key.");
      setKeyLoading(false);
      return;
    }

    if (keyInput.trim().toUpperCase() !== secretKey) {
      setKeyError("Invalid secret key. Please check and try again.");
      setKeyLoading(false);
      return;
    }

    try {
      sessionStorage.setItem("mauze-admin-otp-verified", "true");
      const result = await onLoginSuccess(tempUser, "admin", rememberMe);

      if (result?.ok) {
        sessionStorage.removeItem("mauze-admin-otp-flow");
        setKeyLoading(false);
      } else {
        setKeyError(result?.message || "This account cannot access the admin portal.");
        setKeyLoading(false);
        sessionStorage.removeItem("mauze-admin-otp-verified");
      }
    } catch (err) {
      console.error("Success login trigger failure:", err);
      setKeyError("Portal authorization failed. Please try again.");
      setKeyLoading(false);
    }
  };

  const handleOtpCancel = async () => {
    sessionStorage.removeItem("mauze-admin-otp-flow");
    setSecretKey("");
    setKeyInput("");
    setKeyError("");
    setKeyTimer(60);
    setStep("login");
    setTempUser(null);
    setError(null);
    
    await supabase.auth.signOut();
    
    if (onCancel) {
      onCancel();
    }
  };

  const handleRoleSwitch = (roleId) => {
    setSelectedRole(roleId);
    setError(null);
    if (!rememberMe) {
      setEmail("");
      setPassword("");
    }
  };

  // Escape key closes the OTP modal (defined after handleOtpCancel for hoisting)
  useEffect(() => {
    if (step !== "otp") return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleOtpCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, handleOtpCancel]);

  // OTP rendered as modal overlay inside the login page below

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

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={18} className="spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Open {activeRole.label} Portal
                </>
              )}
            </button>

            {biometricAvailable && biometricReady && (
              <button
                type="button"
                className="login-button biometric-btn"
                disabled={biometricLoading}
                onClick={async () => {
                  setBiometricLoading(true);
                  setError(null);
                  try {
                    const creds = await getBiometricCredentials();
                    if (!creds) {
                      setBiometricLoading(false);
                      return;
                    }
                    setEmail(creds.email);
                    setPassword(creds.password);

                    if (selectedRole === "admin") {
                      sessionStorage.setItem("mauze-admin-otp-flow", "true");
                    }

                    const { data, error: authError } = await supabase.auth.signInWithPassword({
                      email: creds.email,
                      password: creds.password,
                    });

                    if (authError) {
                      setError(authError.message);
                      setBiometricLoading(false);
                      if (selectedRole === "admin") sessionStorage.removeItem("mauze-admin-otp-flow");
                      return;
                    }

                    if (selectedRole === "admin") {
                      setTempUser(data.user);
                      setStep("otp");
                      setPassword("");
                      setBiometricLoading(false);
                      return;
                    }

                    const result = await onLoginSuccess(data.user, selectedRole, true);
                    if (!result?.ok) {
                      setError(result.message || "This account cannot access the selected portal.");
                    }
                  } catch (err) {
                    setError("Biometric login failed. Please log in manually.");
                  } finally {
                    setBiometricLoading(false);
                  }
                }}
              >
                {biometricLoading ? (
                  <>
                    <Loader2 size={18} className="spinner" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Fingerprint size={18} />
                    Log in with Biometric
                  </>
                )}
              </button>
            )}
          </form>

          {/* ── Forgot Password Section ── */}
          {forgotPasswordMode && (
            <div className="forgot-password-section">
              <div className="forgot-divider" />

              {forgotSuccess ? (
                <div className="forgot-success">
                  <CheckCircle2 size={24} className="forgot-success-icon" />
                  <h4>Password Reset Successful</h4>
                  <p>{forgotSuccess}</p>
                  <button
                    type="button"
                    className="login-button"
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setForgotSuccess("");
                      setForgotCurrentPassword("");
                      setForgotNewPassword("");
                      setForgotConfirmPassword("");
                    }}
                    style={{ marginTop: '12px' }}
                  >
                    <LogIn size={16} />
                    Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <h4 className="forgot-title">
                    <KeyRound size={16} /> Reset Your Password
                  </h4>
                  <p className="forgot-desc">
                    Verify your identity with your current password, then set a new one.
                  </p>

                  <div className="input-group">
                    <label htmlFor="forgot-email">Email Address</label>
                    <div className="input-with-icon">
                      <Mail size={18} />
                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="forgot-current-password">Current Password</label>
                    <div className="input-with-icon">
                      <Lock size={18} />
                      <input
                        id="forgot-current-password"
                        type={showForgotCurrent ? "text" : "password"}
                        value={forgotCurrentPassword}
                        onChange={(e) => setForgotCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowForgotCurrent((prev) => !prev)}
                        tabIndex={-1}
                        aria-label={showForgotCurrent ? "Hide current password" : "Show current password"}
                      >
                        {showForgotCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="forgot-divider-light" />

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
                        aria-label={showForgotPassword ? "Hide password" : "Show password"}
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
                        aria-label={showForgotConfirm ? "Hide password" : "Show password"}
                      >
                        {showForgotConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

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

                      if (!email.trim()) {
                        setForgotError("Please enter your email address.");
                        return;
                      }
                      if (!forgotCurrentPassword) {
                        setForgotError("Please enter your current password.");
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
                      if (forgotNewPassword === forgotCurrentPassword) {
                        setForgotError("New password must be different from current password.");
                        return;
                      }

                      setForgotLoading(true);
                      try {
                        // 1. Verify identity by signing in with current credentials
                        const { error: signInError } = await supabase.auth.signInWithPassword({
                          email: email.trim(),
                          password: forgotCurrentPassword,
                        });

                        if (signInError) {
                          setForgotError("Current password is incorrect. Please try again.");
                          setForgotLoading(false);
                          return;
                        }

                        // 2. Update to new password via Supabase Auth
                        const { error: updateError } = await supabase.auth.updateUser({
                          password: forgotNewPassword,
                        });

                        if (updateError) {
                          setForgotError(updateError.message || "Failed to update password. Please try again.");
                          setForgotLoading(false);
                          return;
                        }

                        // 3. Sign out so user returns to login page
                        await supabase.auth.signOut();

                        setForgotSuccess(
                          "Your password has been changed successfully! You can now login with your new password."
                        );
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
                        Changing Password...
                      </>
                    ) : (
                      <>
                        <KeyRound size={18} />
                        Change Password
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setForgotError("");
                      setForgotCurrentPassword("");
                      setForgotNewPassword("");
                      setForgotConfirmPassword("");
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

      {/* ── OTP Secret Key Modal Overlay ── */}
      {step === "otp" && (
        <div className="otp-modal-overlay">
          <div className="otp-modal-card">
            <div className="login-card-accent" />

            <div className="login-logo">
              <img src="/logo.png" alt="Mauze Tahfeez" className="login-logo-img" />
            </div>

            <div className="login-body">
              <div className="content-header">
                <div className="otp-shield-badge">
                  <ShieldCheck size={32} className="otp-shield-icon" />
                </div>
                <h1 className="content-title">Admin Verification</h1>
                <p className="content-desc">
                  A secure secret key has been generated. Enter it below to access the Admin portal.
                </p>
              </div>

              {/* Timer bar */}
              <div className="secret-key-timer-bar">
                <div
                  className="secret-key-timer-fill"
                  style={{ width: `${(keyTimer / 60) * 100}%` }}
                />
              </div>
              <div className="secret-key-timer-text">
                {keyTimer > 0 ? (
                  <span>Key expires in <strong>{keyTimer}s</strong></span>
                ) : (
                  <span className="secret-key-expired">Key expired — please cancel and log in again</span>
                )}
              </div>

              {/* Secret key display */}
              <div className="secret-key-display">
                <KeyRound size={22} />
                <span className="secret-key-code">{secretKey}</span>
              </div>

              <form onSubmit={handleVerifySecretKey} className="login-form">
                <div className="input-group">
                  <label htmlFor="key-input">Enter Secret Key</label>
                  <div className="input-with-icon">
                    <KeyRound size={18} />
                    <input
                      id="key-input"
                      type="text"
                      className="otp-input-field"
                      placeholder="ENTER 6-DIGIT KEY"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value.toUpperCase().slice(0, 6))}
                      required
                      autoComplete="off"
                      maxLength={6}
                      disabled={keyTimer <= 0}
                    />
                  </div>
                </div>

                {keyError && (
                  <div className="error-message">
                    <AlertCircle size={16} />
                    <span>{keyError}</span>
                  </div>
                )}

                <button type="submit" className="login-button" disabled={keyLoading || keyTimer <= 0}>
                  {keyLoading ? (
                    <>
                      <Loader2 size={18} className="spinner" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Verify & Access Admin
                    </>
                  )}
                </button>
              </form>

              <button
                type="button"
                className="forgot-cancel-btn"
                onClick={handleOtpCancel}
                style={{ marginTop: "16px" }}
              >
                <X size={14} /> Cancel & Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
