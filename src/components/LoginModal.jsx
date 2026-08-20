import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function LoginModal({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Force-password-change state
  const [mustChange, setMustChange]     = useState(false);
  const [userId, setUserId]             = useState(null);
  const [currentPwd, setCurrentPwd]     = useState('');
  const [newPwd, setNewPwd]             = useState('');
  const [confirmPwd, setConfirmPwd]     = useState('');
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [changing, setChanging]         = useState(false);
  const [changed, setChanged]           = useState(false);

  // ── Sign-in ──────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    onLogin(username, password, (err, meta) => {
      setLoading(false);
      if (meta?.requirePasswordChange) {
        // Server told us this account must change its password first
        setUserId(meta.userId);
        setCurrentPwd(password); // pre-fill with the password they just typed
        setMustChange(true);
        setError('');
      } else if (err) {
        setError(err);
      }
    });
  };

  // ── Forced password change ───────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPwd !== confirmPwd) {
      setError('New passwords do not match.');
      return;
    }
    if (newPwd.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    setChanging(true);
    try {
      const res = await fetch(`${API_BASE}/auth/force-change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, current_password: currentPwd, new_password: newPwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to change password. Please try again.');
        setChanging(false);
        return;
      }
      // Password changed — now log in automatically with the new password
      setChanged(true);
      setChanging(false);
      setTimeout(() => {
        onLogin(username, newPwd, (err) => {
          if (err) setError(err);
        });
      }, 1200);
    } catch (e) {
      setError(e.message || 'Could not reach the server.');
      setChanging(false);
    }
  };

  // ── Forced password change screen ───────────────────────────
  if (mustChange) {
    return (
      <div className="modern-auth-shell">
        <div className="modern-auth-bg" />
        <div className="modern-auth-container">
          <div className="modern-auth-card compact">

            <div className="modern-auth-header compact">
              <div className="logo-placeholder" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <KeyRound size={28} color="#f59e0b" />
              </div>
              <h2>Set Your Password</h2>
              <p>Your account requires a new password before you can sign in for the first time.</p>
            </div>

            {changed ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
                <CheckCircle2 size={40} color="#10b981" />
                <p style={{ color: '#10b981', fontWeight: '600', fontSize: '15px' }}>Password changed! Signing you in…</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="modern-auth-error">
                    <span>⚠</span> {error}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="modern-auth-form compact">
                  <div className="modern-form-group compact">
                    <label>Current (Temporary) Password</label>
                    <div className="modern-input-wrapper">
                      <Lock className="modern-input-icon" size={16} />
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        placeholder="The password you just entered"
                        value={currentPwd}
                        onChange={e => setCurrentPwd(e.target.value)}
                        required
                      />
                      <button type="button" className="modern-pwd-toggle" onClick={() => setShowCurrent(v => !v)}>
                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="modern-form-group compact">
                    <label>New Password</label>
                    <div className="modern-input-wrapper">
                      <Lock className="modern-input-icon" size={16} />
                      <input
                        type={showNew ? 'text' : 'password'}
                        placeholder="Choose a strong password"
                        value={newPwd}
                        onChange={e => setNewPwd(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button type="button" className="modern-pwd-toggle" onClick={() => setShowNew(v => !v)}>
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="modern-form-group compact">
                    <label>Confirm New Password</label>
                    <div className="modern-input-wrapper">
                      <Lock className="modern-input-icon" size={16} />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat your new password"
                        value={confirmPwd}
                        onChange={e => setConfirmPwd(e.target.value)}
                        required
                      />
                      <button type="button" className="modern-pwd-toggle" onClick={() => setShowConfirm(v => !v)}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="modern-submit-btn compact"
                    disabled={changing}
                  >
                    {changing ? 'Saving…' : 'Set Password & Sign In'}
                  </button>
                </form>

                <div className="modern-auth-footer compact">
                  <p>
                    <button type="button" onClick={() => { setMustChange(false); setError(''); }}>
                      ← Back to sign in
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Normal sign-in screen ────────────────────────────────────
  return (
    <div className="modern-auth-shell">
      <div className="modern-auth-bg" />
      <div className="modern-auth-container">
        
        <div className="modern-auth-card compact">
          <div className="modern-auth-header compact">
            <div className="logo-placeholder">
              <img src="/logo.jpg" alt="Company logo" />
            </div>
            <h2>Store Management System</h2>
            <p>Welcome back! Sign in to continue.</p>
          </div>

          {error && (
            <div className="modern-auth-error">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="modern-auth-form compact">
            <div className="modern-form-group compact">
              <label>Email or Username</label>
              <div className="modern-input-wrapper">
                <User className="modern-input-icon" size={16} />
                <input
                  type="text"
                  placeholder="Enter your email or username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="modern-form-group compact">
              <div className="modern-password-labels">
                <label>Password</label>
                <button
                  type="button"
                  className="modern-forgot-pwd"
                  onClick={() => setError('Sign in first, then open My Account to change your password. If you cannot sign in, ask an Administrator to reset it.')}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="modern-input-wrapper">
                <Lock className="modern-input-icon" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="modern-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="modern-submit-btn compact"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="modern-auth-footer compact">
            <p>Need access? <button type="button" onClick={() => setError('Please ask your administrator to create an account for you.')}>Contact Admin</button></p>
          </div>
        </div>
      </div>
    </div>
  );
}
