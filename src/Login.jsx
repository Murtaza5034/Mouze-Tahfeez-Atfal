import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, Loader2, Lock, LogIn, Mail, ShieldCheck, Users } from "lucide-react";
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
    id: "admin",
    label: "Admin",
    title: "Admin Portal",
    description: "Manage schedules, announcements, teacher attendance, and child overviews.",
    icon: ShieldCheck,
    gradient: "linear-gradient(135deg, #5a3e1b 0%, #3d2a12 100%)",
  },
  {
    id: "teacher",
    label: "Teacher",
    title: "Teacher Portal",
    description: "Open your group cards and fill child results from the tahfeez report form.",
    icon: LogIn,
    gradient: "linear-gradient(135deg, #b8941f 0%, #7a5c0e 100%)",
  },
];

export default function Login({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState("parents");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const welcomeRef = useRef(null);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("mauze-remember-me") !== "false";
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("mauze-app-theme") || "ashara";
    document.body.setAttribute("data-theme", savedTheme);
  }, []);

  useEffect(() => {
    if (!welcomeRef.current) return;
    const anim = lottie.loadAnimation({
      container: welcomeRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: "/Welcome.json",
    });
    return () => anim.destroy();
  }, []);

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

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Gold accent top bar */}
        <div className="login-card-accent" />

        {/* Vertical Sidebar Tabs */}
        <div className="login-sidebar">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="Mauze Tahfeez" className="sidebar-logo-img" />
          </div>
          <div className="sidebar-portal-label">SELECT PORTAL</div>
          <div className="sidebar-tabs">
            {ROLE_OPTIONS.map((role) => {
              const Icon = role.icon;
              const isActive = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  className={`sidebar-tab ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setSelectedRole(role.id);
                    setError(null);
                    setEmail("");
                    setPassword("");
                  }}
                  style={isActive ? { background: role.gradient } : undefined}
                >
                  <div className="sidebar-tab-icon">
                    <Icon size={20} />
                  </div>
                  <span className="sidebar-tab-label">{role.label}</span>
                  {isActive && <div className="sidebar-tab-indicator" />}
                </button>
              );
            })}
          </div>
          <div className="sidebar-footer">
            <div ref={welcomeRef} className="welcome-animation" />
            <p className="sidebar-footer-text">&copy; 2026 Mahad al zahra</p>
          </div>
        </div>

        {/* Login Content */}
        <div className="login-content">
          <div className="login-content-inner">
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
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
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
          </div>
        </div>
      </div>
    </div>
  );
}
