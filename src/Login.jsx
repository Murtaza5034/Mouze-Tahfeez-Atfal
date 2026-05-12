import React, { useState } from "react";
import { AlertCircle, Loader2, Lock, LogIn, Mail, ShieldCheck, Users } from "lucide-react";
import { supabase } from "./supabaseClient";
import "./Login.css";

const ROLE_OPTIONS = [
  {
    id: "parents",
    label: "Parents",
    title: "Parents Login",
    description: "Access your child's schedule, announcements, and tahfeez report.",
    icon: Users,
  },
  {
    id: "admin",
    label: "Admin",
    title: "Admin Login",
    description: "Manage schedules, announcements, teacher attendance, and child overviews.",
    icon: ShieldCheck,
  },
  {
    id: "teacher",
    label: "Teacher",
    title: "Teacher Login",
    description: "Open your group cards and fill child results from the tahfeez report form.",
    icon: LogIn,
  },
];

export default function Login({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState("parents");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

    const result = await onLoginSuccess(data.user, selectedRole);

    if (!result?.ok) {
      setError(result?.message || "This account cannot access the selected portal.");
      setLoading(false);
      return;
    }
  };

  return (
    <div className="login-container">
      <div className="login-card role-card">
        <div className="login-header">
          <div className="logo-wrapper">
            <img src="/logo.png" alt="Mauze Tahfeez" className="app-logo" />
          </div>
          <h1>{activeRole.title}</h1>
          <p>{activeRole.description}</p>
        </div>

        <div className="role-switcher" aria-label="Select login role">
          {ROLE_OPTIONS.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                type="button"
                className={selectedRole === role.id ? "role-tab active" : "role-tab"}
                onClick={() => setSelectedRole(role.id)}
              >
                <Icon size={16} />
                {role.label}
              </button>
            );
          })}
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
              />
            </div>
          </div>

          {error ? (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : null}

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

        <div className="login-footer">
          <p>&copy; 2026 Mahad al zahra Aljamea tus saifiyah Galiakot</p>
        </div>
      </div>
    </div>
  );
}
