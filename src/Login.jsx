import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, LogIn, Mail, ShieldCheck, Users, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import lottie from "lottie-web";
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
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
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

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const result = await onLoginSuccess(data.user, selectedRole, rememberMe);

    if (!result?.ok) {
      setError(result?.message || "This account cannot access the selected portal.");
      setLoading(false);
      return;
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
                    Enter your email, new password, and confirm it below.
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
                      if (!forgotNewPassword || forgotNewPassword.length < 6) {
                        setForgotError("New password must be at least 6 characters.");
                        return;
                      }
                      if (forgotNewPassword !== forgotConfirmPassword) {
                        setForgotError("Passwords do not match.");
                        return;
                      }

                      setForgotLoading(true);
                      try {
                        const { data, error: rpcError } = await supabase.rpc(
                          "reset_user_password",
                          {
                            target_email: email.trim(),
                            new_password: forgotNewPassword,
                          }
                        );

                        if (rpcError) {
                          setForgotError(rpcError.message || "Failed to reset password. Please try again.");
                        } else if (data?.success) {
                          setForgotSuccess(
                            data?.message ||
                              "Your password has been reset successfully! You can now login with your new password."
                          );
                          setPassword(forgotNewPassword);
                        } else {
                          setForgotError(
                            data?.message ||
                              "Failed to reset password. Please ensure your email is correct."
                          );
                        }
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
                        Resetting Password...
                      </>
                    ) : (
                      <>
                        <KeyRound size={18} />
                        Reset Password
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setForgotError("");
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
    </div>
  );
}
