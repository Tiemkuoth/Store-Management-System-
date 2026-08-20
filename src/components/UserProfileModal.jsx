import React, { useEffect, useRef, useState } from 'react';
import { Lock, Eye, EyeOff, Save, X, CheckCircle, Camera, Trash2, User, Mail, Shield, AlertCircle } from 'lucide-react';
import UserAvatar from './UserAvatar';
import apiFetch from '../utils/apiFetch';

export default function UserProfileModal({ currentUser, onClose, onProfileUpdated }) {
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('PROFILE');
  const [profileData, setProfileData] = useState({
    full_name: currentUser.full_name || '',
    email: currentUser.email || '',
    avatar_url: currentUser.avatar_url || ''
  });
  const [pwdData, setPwdData] = useState({ current: '', next: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const hasProfileChanges =
    profileData.full_name !== (currentUser.full_name || '') ||
    profileData.email !== (currentUser.email || '') ||
    profileData.avatar_url !== (currentUser.avatar_url || '') ||
    previewAvatar !== null;

  const getPasswordStrength = (value) => {
    if (!value) return '';
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (score <= 1) return 'Weak';
    if (score === 2) return 'Fair';
    return 'Strong';
  };

  useEffect(() => {
    setProfileData({
      full_name: currentUser.full_name || '',
      email: currentUser.email || '',
      avatar_url: currentUser.avatar_url || ''
    });
  }, [currentUser]);

  const flash = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const processImageFile = async (file) => {
    if (!file) return;
    const ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if (!ALLOWED.includes(file.type.toLowerCase())) {
      flash('Only JPEG, PNG, WebP, or GIF images are allowed.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flash('Image must be under 5 MB.', 'error');
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (ev) => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => {
            const MAX = 300;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
      setPreviewAvatar(dataUrl);
      setProfileData(p => ({ ...p, avatar_url: dataUrl }));
      flash('Image preview ready. Save profile to apply changes.');
    } catch (err) {
      flash('Could not process photo. Please try again.', 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e) => processImageFile(e.target.files?.[0]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processImageFile(e.dataTransfer.files?.[0]);
  };

  const handleRemovePhoto = async () => {
    if (previewAvatar) {
      setPreviewAvatar(null);
      setProfileData(p => ({ ...p, avatar_url: currentUser.avatar_url || '' }));
      flash('Preview removed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/auth/avatar', { method: 'DELETE' });
      let data = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        flash(data?.error || 'Could not remove photo.', 'error');
        return;
      }
      setProfileData(p => ({ ...p, avatar_url: '' }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      const updatedUser = { ...currentUser, avatar_url: null };
      localStorage.setItem('current_user', JSON.stringify(updatedUser));
      onProfileUpdated?.(updatedUser);
      flash('Photo removed.');
    } catch {
      flash('Could not remove photo. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!hasProfileChanges) {
      flash('No changes to save', 'info');
      return;
    }
    if (!profileData.full_name?.trim()) {
      flash('Full name is required', 'error');
      return;
    }
    setLoading(true);
    try {
      let finalAvatarUrl = profileData.avatar_url;
      if (previewAvatar) {
        const upRes = await apiFetch('/auth/upload-avatar', {
          method: 'POST',
          body: JSON.stringify({ avatar_data_url: previewAvatar }),
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData?.error || 'Failed to upload photo');
        finalAvatarUrl = upData.avatar_url || previewAvatar;
      }

      let res;
      try {
        res = await apiFetch('/auth/update-profile', {
          method: 'PUT',
          body: JSON.stringify({
            full_name: profileData.full_name.trim(),
            email: profileData.email,
            avatar_url: finalAvatarUrl || null,
          }),
        });
      } catch (networkErr) {
        flash('Could not reach the server. Please try again.', 'error');
        setLoading(false);
        return;
      }

      let data = {};
      try {
        data = await res.json();
      } catch {
        // Response body unreadable — treat as success if status was 200
        if (res.ok) {
          data = {};
        } else {
          flash('Unexpected server response. Please try again.', 'error');
          setLoading(false);
          return;
        }
      }

      if (!res.ok) {
        flash(data?.error || `Save failed (${res.status})`, 'error');
        setLoading(false);
        return;
      }

      // Update local state
      const updatedUser = {
        ...currentUser,
        full_name: profileData.full_name.trim(),
        email: profileData.email,
        avatar_url: finalAvatarUrl || currentUser.avatar_url || null,
      };
      setPreviewAvatar(null);
      setProfileData(p => ({ ...p, avatar_url: updatedUser.avatar_url }));
      localStorage.setItem('current_user', JSON.stringify(updatedUser));
      onProfileUpdated?.(updatedUser);
      flash('Profile saved successfully!');
    } catch (err) {
      // Catch-all — never propagate upward or touch the session
      flash(err.message || 'Unable to save profile. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdData.next !== pwdData.confirm) {
      flash('New passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: pwdData.current,
          new_password: pwdData.next,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Password change failed');
      setPwdData({ current: '', next: '', confirm: '' });
      flash('Password changed successfully');
    } catch (err) {
      flash(err.message || 'Unable to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay modern-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modern-profile-modal">
        {toast && (
          <div className={`modern-toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}

        <button onClick={onClose} className="modern-modal-close" aria-label="Close profile">
          <X size={20} />
        </button>

        <div className="modern-profile-grid">
          {/* LEFT COLUMN: Overview */}
          <div className="modern-profile-sidebar">
            <div className="modern-profile-avatar-wrapper">
              <div 
                className={`modern-avatar-clickable ${isDragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ border: isDragging ? '2px dashed var(--primary)' : '2px dashed transparent', padding: '4px', borderRadius: '20px' }}
              >
                <UserAvatar user={{ ...currentUser, full_name: profileData.full_name, avatar_url: profileData.avatar_url }} size={140} key={profileData.avatar_url || 'no-avatar'} />
                <div className="modern-avatar-overlay">
                  <Camera size={24} />
                  <span>Update</span>
                </div>
              </div>
              <h2 className="modern-profile-name">{profileData.full_name || currentUser.username}</h2>
              <span className="modern-profile-role">{currentUser.role}</span>
            </div>

            <div className="modern-profile-actions">
              <button type="button" className="modern-btn-outline" onClick={() => fileInputRef.current?.click()}>
                <Camera size={14} /> Change Photo
              </button>
              <button type="button" className="modern-btn-danger-outline" onClick={handleRemovePhoto}>
                <Trash2 size={14} /> Remove
              </button>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
            </div>

            <div className="modern-profile-quick-info">
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className={`status-dot ${currentUser.status === 'Active' ? 'active' : 'inactive'}`}>
                  {currentUser.status || 'Active'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Username</span>
                <span className="info-value">@{currentUser.username}</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Tabs & Forms */}
          <div className="modern-profile-main">
            <div className="modern-tabs-header">
              <button
                type="button"
                className={`modern-tab ${tab === 'PROFILE' ? 'active' : ''}`}
                onClick={() => setTab('PROFILE')}
              >
                <User size={16} /> Account Details
              </button>
              <button
                type="button"
                className={`modern-tab ${tab === 'SECURITY' ? 'active' : ''}`}
                onClick={() => setTab('SECURITY')}
              >
                <Shield size={16} /> Security Settings
              </button>
            </div>

            <div className="modern-tab-content">
              {tab === 'PROFILE' ? (
                <form onSubmit={handleSaveProfile} className="modern-form">
                  <div className="modern-form-header">
                    <h3>Personal Information</h3>
                    <p>Update your personal details and contact information.</p>
                  </div>

                  <div className="modern-input-group">
                    <label>Full Name</label>
                    <div className="modern-elegant-input">
                      <User size={16} className="input-icon" />
                      <input
                        type="text"
                        value={profileData.full_name}
                        onChange={e => setProfileData({ ...profileData, full_name: e.target.value })}
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </div>

                  <div className="modern-input-group">
                    <label>Email Address</label>
                    <div className="modern-elegant-input">
                      <Mail size={16} className="input-icon" />
                      <input
                        type="email"
                        value={profileData.email}
                        onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                        placeholder="name@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="modern-input-group">
                    <label>Username</label>
                    <div className="modern-elegant-input readonly">
                      <User size={16} className="input-icon" />
                      <input
                        type="text"
                        value={currentUser.username}
                        readOnly
                      />
                    </div>
                    <span className="input-hint">Your username cannot be changed.</span>
                  </div>

                  <div className="modern-form-actions">
                    <button type="button" className="modern-btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                      type="submit"
                      className="modern-btn-primary"
                      disabled={loading || !hasProfileChanges}
                    >
                      <Save size={16} /> {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleChangePassword} className="modern-form">
                  <div className="modern-form-header">
                    <h3>Change Password</h3>
                    <p>Ensure your account is using a long, random password to stay secure.</p>
                  </div>

                  <div className="modern-input-group">
                    <label>Current Password</label>
                    <div className="modern-elegant-input">
                      <Lock size={16} className="input-icon" />
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        value={pwdData.current}
                        onChange={e => setPwdData({ ...pwdData, current: e.target.value })}
                        placeholder="Enter current password"
                        required
                      />
                      <button type="button" className="input-action-btn" onClick={() => setShowCurrent(!showCurrent)}>
                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="modern-input-group">
                    <label>New Password</label>
                    <div className="modern-elegant-input">
                      <Lock size={16} className="input-icon" />
                      <input
                        type={showNext ? 'text' : 'password'}
                        value={pwdData.next}
                        onChange={e => setPwdData({ ...pwdData, next: e.target.value })}
                        placeholder="Enter new password"
                        minLength={4}
                        required
                      />
                      <button type="button" className="input-action-btn" onClick={() => setShowNext(!showNext)}>
                        {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {pwdData.next && (
                      <span className={`input-hint strength-${getPasswordStrength(pwdData.next).toLowerCase()}`}>
                        Strength: {getPasswordStrength(pwdData.next)}
                      </span>
                    )}
                  </div>

                  <div className="modern-input-group">
                    <label>Confirm Password</label>
                    <div className="modern-elegant-input">
                      <Lock size={16} className="input-icon" />
                      <input
                        type="password"
                        value={pwdData.confirm}
                        onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                    {pwdData.confirm && pwdData.next !== pwdData.confirm && (
                      <span className="input-hint error-text">Passwords do not match</span>
                    )}
                  </div>

                  <div className="modern-form-actions">
                    <button type="button" className="modern-btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="submit" className="modern-btn-primary" disabled={loading}>
                      <Lock size={16} /> {loading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
