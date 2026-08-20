import React, { useState, useEffect, useRef, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import {
  ShieldCheck, UserPlus, FileText, Edit2, Trash2, KeyRound, Camera,
  CheckCircle2, XCircle, Search, Filter, Lock, Unlock, UserCheck, UserX
} from 'lucide-react';
import UserAvatar from './UserAvatar';

import apiFetch from '../utils/apiFetch';
import { API_BASE } from '../utils/apiFetch';
import { sanitizeText } from '../utils/displayValue';

const ALL_ROLES = ['Administrator', 'Store Manager', 'Storekeeper', 'Auditor', 'Viewer'];

const ROLE_BADGE = {
  Administrator: 'badge-danger',
  'Store Manager': 'badge-warning',
  Storekeeper: 'badge-success',
  Auditor: 'badge-info',
  Viewer: 'badge-secondary',
};

function StatusBadge({ status }) {
  const s = status || 'Active';
  if (s === 'Active')   return <span className="badge badge-success"><CheckCircle2 size={11} /> Active</span>;
  if (s === 'Locked')   return <span className="badge badge-warning"><Lock size={11} /> Locked</span>;
  return <span className="badge badge-danger"><XCircle size={11} /> Inactive</span>;
}

export default function UserAndAuditManager({ users = [], auditLogs = [], currentUser, onAddUser, onRefresh, readOnly = false }) {
  // Use props passed from App.jsx instead of trying to destruct incorrectly from DataContext
  const [activeTab, setActiveTab]         = useState('USERS');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPwdModal, setShowPwdModal]   = useState(false);
  const [showDelConfirm, setShowDelConfirm] = useState(false);
  const [selectedUser, setSelectedUser]   = useState(null);
  const [newPassword, setNewPassword]     = useState('');
  const [userSearch, setUserSearch]       = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const editAvatarInputRef = useRef(null);
  const [auditSearch, setAuditSearch]     = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo]     = useState('');
  const [loginHistory, setLoginHistory]   = useState([]);
  const [loginHistoryUser, setLoginHistoryUser] = useState(null);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [toast, setToast]                 = useState(null);

  const [formData, setFormData] = useState({
    username: '', password: '', confirm_password: '', full_name: '', email: '', phone: '', role: 'Storekeeper', avatar_url: ''
  });
  const [editData, setEditData] = useState({
    full_name: '', email: '', role: 'Storekeeper', status: 'Active'
  });
  const createAvatarInputRef = useRef(null);

  // Role-based capability checks
  const isAdmin   = currentUser?.role === 'Administrator' && !readOnly;
  const isManager = currentUser?.role === 'Store Manager' && !readOnly;
  const canManageUsers = isAdmin || isManager;

  // Roles a Store Manager is allowed to assign (cannot create/promote Administrators)
  const managerAllowedRoles = ['Store Manager', 'Storekeeper', 'Auditor', 'Viewer'];

  // Store Manager cannot touch Administrator accounts
  const canActOn = (u) => {
    if (isAdmin) return u.id !== currentUser?.id; // admin can act on all except self (delete)
    if (isManager) return u.role !== 'Administrator' && u.id !== currentUser?.id;
    return false;
  };

  // Can edit user profile/role info
  const canEditUser = (u) => {
    if (isAdmin && u.id !== currentUser?.id) return true;
    if (isManager && u.role !== 'Administrator' && u.id !== currentUser?.id) return true;
    return false;
  };

  // Roles selectable in add/edit forms — Managers cannot assign or create Administrators
  const selectableRoles = isAdmin ? ALL_ROLES : managerAllowedRoles;

  // Auditors see only audit tab in read-only mode
  useEffect(() => { if (readOnly) setActiveTab('AUDIT'); }, [readOnly]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── CREATE ── */
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      showToast('Passwords do not match', 'error');
      return;
    }
    const trimmedUsername = formData.username?.trim ? formData.username.trim() : formData.username;
    const { confirm_password, ...rest } = formData;
    const trimmedData = { ...rest, username: trimmedUsername };
    const error = await onAddUser(trimmedData);
    if (error) {
      showToast(error, 'error');
      return;
    }
    setShowAddModal(false);
    setFormData({ username: '', password: '', confirm_password: '', full_name: '', email: '', phone: '', role: 'Storekeeper', avatar_url: '' });
    showToast('User account created successfully');
  };

  /* ── EDIT ── */
  const openEdit = (u) => {
    if (String(u.id) === String(currentUser?.id)) {
      showToast('Use Edit Profile to update your own account.', 'error');
      return;
    }
    setSelectedUser(u);
    setEditData({ full_name: u.full_name, email: u.email, role: u.role, status: u.status || 'Active' });
    setEditAvatarUrl(u.avatar_url || '');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editData, avatar_url: editAvatarUrl || null })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowEditModal(false);
      onRefresh?.();
      showToast('User updated successfully');
    } catch (err) { showToast(err.message || 'Failed to update user', 'error'); }
  };

  /* ── PASSWORD RESET ── */
  const openPasswordReset = (u) => { setSelectedUser(u); setNewPassword(''); setShowPwdModal(true); };

  /* ── LOGIN HISTORY ── */
  const openLoginHistory = async (u) => {
    setLoginHistoryUser(u);
    setLoginHistory([]);
    setShowLoginHistory(true);
    try {
      const res = await apiFetch(`/users/${u.id}/login-history`);
      if (res.ok) { const data = await res.json(); setLoginHistory(data); }
    } catch { /* silent */ }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/users/${selectedUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password: newPassword })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowPwdModal(false);
      showToast(`Password reset for ${selectedUser.username}`);
    } catch (err) { showToast(err.message || 'Failed to reset password', 'error'); }
  };

  /* ── STATUS CHANGE (Lock / Unlock / Activate / Deactivate) ── */
  const handleSetStatus = async (u, newStatus) => {
    try {
      const res = await apiFetch(`/users/${u.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      onRefresh?.();
      const labels = { Active: 'activated', Inactive: 'deactivated', Locked: 'locked' };
      showToast(`User "${u.username}" ${labels[newStatus] || newStatus}`);
    } catch (err) { showToast(err.message || 'Failed to update status', 'error'); }
  };

  /* ── DELETE ── */
  const openDelete = (u) => { setSelectedUser(u); setShowDelConfirm(true); };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/users/${selectedUser.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowDelConfirm(false);
      onRefresh?.();
      showToast(`User "${selectedUser.username}" deleted`);
    } catch (err) { showToast(err.message || 'Failed to delete user', 'error'); }
  };

  /* ── AUDIT filtering ── */
  const uniqueActions = ['ALL', ...new Set(auditLogs.map(l => l.action_type))];
  const filteredLogs  = auditLogs.filter(l => {
    const matchSearch = auditSearch === '' ||
      (l.username || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (l.description || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (l.action_type || '').toLowerCase().includes(auditSearch.toLowerCase());
    const matchAction = auditActionFilter === 'ALL' || l.action_type === auditActionFilter;
    const logDate = l.created_at ? new Date(l.created_at) : null;
    const matchFrom = !auditDateFrom || (logDate && logDate >= new Date(auditDateFrom));
    const matchTo   = !auditDateTo   || (logDate && logDate <= new Date(auditDateTo + 'T23:59:59'));
    return matchSearch && matchAction && matchFrom && matchTo;
  });

  /* ── USER list filtering ── */
  const filteredUsers = users.filter(u =>
    userSearch === '' ||
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'error' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      {/* ── Page header card ── */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>

        {/* Top row: identity + action */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--bg-border)',
        }}>
          {/* Left: icon + title + description */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
              background: 'rgba(51,102,255,0.10)', border: '1px solid rgba(51,102,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={20} color="var(--primary)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-muted-strong)', whiteSpace: 'nowrap' }}>
                  User Roles &amp; Audits
                </h2>
                {readOnly && (
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '2px 10px',
                    borderRadius: '999px', background: 'rgba(244,161,0,0.12)',
                    color: '#7a5100', border: '1px solid rgba(244,161,0,0.25)',
                    whiteSpace: 'nowrap',
                  }}>Read-only</span>
                )}
                {isManager && (
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '2px 10px',
                    borderRadius: '999px', background: 'rgba(245,158,11,0.10)',
                    color: '#92400e', border: '1px solid rgba(245,158,11,0.25)',
                    whiteSpace: 'nowrap',
                  }}>Store Manager view</span>
                )}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Manage user accounts, roles &amp; permissions, and monitor system activity logs
              </p>
            </div>
          </div>

          {/* Right: action button */}
          {canManageUsers && activeTab === 'USERS' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <UserPlus size={15} /> Add System User
            </button>
          )}
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: '4px', padding: '10px 16px', flexWrap: 'wrap' }}>
          {!readOnly && (
            <button
              className={`btn btn-sm ${activeTab === 'USERS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('USERS')}
            >
              <ShieldCheck size={14} /> System Users ({users.length})
            </button>
          )}
          <button
            className={`btn btn-sm ${activeTab === 'AUDIT' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('AUDIT')}
          >
            <FileText size={14} /> Audit Trail ({filteredLogs.length})
          </button>
        </div>
      </div>


      {/* ── USERS TAB ── */}
      {activeTab === 'USERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Search + info bar */}
          <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text" className="form-input"
                placeholder="Search by name, username, email, role…"
                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                style={{ paddingLeft: '34px' }}
              />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filteredUsers.length} of {users.length} users</span>
          </div>


          <div className="table-container glass-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>User</th>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  {canManageUsers && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No users match your search.</td></tr>
                ) : filteredUsers.map(u => {
                  const canAct = canActOn(u);
                  return (
                    <tr key={u.id}>
                      <td>
                        <UserAvatar user={u} size={32} status={u.status} />
                      </td>
                      <td><span style={{ fontWeight: '700', color: 'var(--text-muted-strong)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{u.username}</span></td>
                      <td style={{ fontWeight: '600' }}>{u.full_name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{sanitizeText(u.email, 'Email pending')}</td>
                      <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-info'}`}>{u.role}</span></td>
                      <td><StatusBadge status={u.status} /></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      {canManageUsers && (
                        <td>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>

                            {/* Edit */}
                            {canEditUser(u) && (
                              <button className="btn btn-secondary btn-sm" title="Edit user info & role" onClick={() => openEdit(u)}>
                                <Edit2 size={13} />
                              </button>
                            )}

                            {/* Reset password */}
                            {canAct && (
                              <button className="btn btn-secondary btn-sm" title="Reset password" onClick={() => openPasswordReset(u)}>
                                <KeyRound size={13} />
                              </button>
                            )}

                            {/* Activate */}
                            {canAct && u.status !== 'Active' && (
                              <button className="btn btn-sm" title="Activate account"
                                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                                onClick={() => handleSetStatus(u, 'Active')}>
                                <UserCheck size={13} />
                              </button>
                            )}

                            {/* Deactivate */}
                            {canAct && u.status === 'Active' && u.id !== currentUser?.id && (
                              <button className="btn btn-sm" title="Deactivate account"
                                style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' }}
                                onClick={() => handleSetStatus(u, 'Inactive')}>
                                <UserX size={13} />
                              </button>
                            )}

                            {/* Lock */}
                            {canAct && u.status !== 'Locked' && u.id !== currentUser?.id && (
                              <button className="btn btn-sm" title="Lock account (prevents login)"
                                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                                onClick={() => handleSetStatus(u, 'Locked')}>
                                <Lock size={13} />
                              </button>
                            )}

                            {/* Unlock */}
                            {canAct && u.status === 'Locked' && (
                              <button className="btn btn-sm" title="Unlock account"
                                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
                                onClick={() => handleSetStatus(u, 'Active')}>
                                <Unlock size={13} />
                              </button>
                            )}

                            {/* Delete — Admin only */}
                            {isAdmin && u.id !== currentUser?.id && (
                              <button className="btn btn-danger btn-sm" title="Delete user permanently" onClick={() => openDelete(u)}>
                                <Trash2 size={13} />
                              </button>
                            )}

                            {/* Login History */}
                            {canManageUsers && (
                              <button className="btn btn-secondary btn-sm" title="View login history" onClick={() => openLoginHistory(u)}>
                                <FileText size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AUDIT TAB ── */}
      {activeTab === 'AUDIT' && (
        <>
          <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text" className="form-input"
                placeholder="Search user, action, description…"
                value={auditSearch} onChange={e => setAuditSearch(e.target.value)}
                style={{ paddingLeft: '34px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={15} color="var(--text-muted)" />
              <select className="form-select" style={{ minWidth: '180px' }}
                value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)}>
                {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <input type="date" className="form-input" style={{ width: '145px' }} value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} title="From date" />
            <input type="date" className="form-input" style={{ width: '145px' }} value={auditDateTo}   onChange={e => setAuditDateTo(e.target.value)}   title="To date" />
            {(auditDateFrom || auditDateTo) && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setAuditDateFrom(''); setAuditDateTo(''); }}>Clear</button>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filteredLogs.length} records</span>
          </div>

          <div className="table-container glass-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>User</th><th>Role</th><th>Action</th><th>Description</th><th>IP Address</th><th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No audit logs match your search.</td></tr>
                ) : filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#818cf8' }}>#{log.id}</td>
                    <td style={{ fontWeight: '700' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserAvatar user={{ full_name: log.username || 'System', username: log.username }} size={24} />
                        <span>{log.username || 'System'}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-info">{log.user_role || 'System'}</span></td>
                    <td><span className="badge badge-warning">{log.action_type}</span></td>
                    <td style={{ fontSize: '13px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{log.ip_address}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ADD USER MODAL ── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Register New User Account</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[['Username', 'username', 'text', 'e.g. jsmith'], ['Full Name', 'full_name', 'text', 'John Smith'], ['Email', 'email', 'email', 'jsmith@store.org'], ['Phone', 'phone', 'text', '+251-911-000000'], ['Password', 'password', 'password', '••••••••'], ['Confirm Password', 'confirm_password', 'password', '••••••••']].map(([lbl, key, type, ph]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label">{lbl}</label>
                    <input type={type} className="form-input" placeholder={ph} value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })} required={key !== 'email'} />
                  </div>
                ))}
                <div className="form-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <label className="form-label" style={{ minWidth: '100%' }}>Photo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 320px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }}>
                      {formData.avatar_url ? (
                        <img src={(formData.avatar_url && formData.avatar_url.startsWith('/avatars/')) ? API_BASE.replace(/\/api\/?$/i, '') + formData.avatar_url : formData.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '4px' }}>
                          No Photo
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="file"
                        ref={createAvatarInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith('image/')) {
                            return showToast('Please select a valid image file', 'error');
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            return showToast('Image must be under 5MB', 'error');
                          }
                          const reader = new FileReader();
                          reader.onload = (event) => setFormData(prev => ({ ...prev, avatar_url: event.target.result }));
                          reader.readAsDataURL(file);
                        }}
                      />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => createAvatarInputRef.current?.click()}>
                        <Camera size={13} /> Upload Photo
                      </button>
                      {formData.avatar_url && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormData(prev => ({ ...prev, avatar_url: '' }))}>
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Assign Role</label>
                  <select className="form-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                    {selectableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {formData.role === 'Viewer' && (
                  <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.3)', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Viewer accounts have read-only access to assigned sections only.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><UserPlus size={14} /> Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ── */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Edit User — {selectedUser.username}</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Username <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>(read-only)</span></label>
                  <input type="text" className="form-input" value={selectedUser.username} readOnly style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Photo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }}>
                      {editAvatarUrl ? (
                        <img src={(editAvatarUrl && editAvatarUrl.startsWith('/avatars/')) ? API_BASE.replace(/\/api\/?$/i, '') + editAvatarUrl : editAvatarUrl} alt="User avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No Photo
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <input
                        type="file"
                        ref={editAvatarInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith('image/')) {
                            return showToast('Please select a valid image file', 'error');
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            return showToast('Image must be under 5MB', 'error');
                          }
                          const reader = new FileReader();
                          reader.onload = (event) => setEditAvatarUrl(event.target.result);
                          reader.readAsDataURL(file);
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => editAvatarInputRef.current?.click()}>
                          <Camera size={13} /> Upload Photo
                        </button>
                        {editAvatarUrl && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditAvatarUrl('')}>
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })}>
                    {selectableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Locked">Locked</option>
                  </select>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Locked — user cannot log in until unlocked. Inactive — account is disabled.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {showPwdModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Reset Password — {selectedUser.username}</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowPwdModal(false)}>×</button>
            </div>
            <form onSubmit={handlePasswordReset}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '12px', color: '#f59e0b' }}>
                  You are resetting the password for <strong>{selectedUser.full_name}</strong> ({selectedUser.role}).
                  The user will need to log in with the new password.
                </div>
                <div className="form-group">
                  <label className="form-label">New Password <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="password" className="form-input"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPwdModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><KeyRound size={14} /> Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {showDelConfirm && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#ef4444' }}>Delete User Account</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowDelConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Are you sure you want to permanently delete <strong style={{ color: 'var(--text-muted-strong)' }}>{selectedUser.full_name}</strong> ({selectedUser.username})?
              </p>
              <p style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>
                This action cannot be undone. Consider deactivating or locking the account instead.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={14} /> Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGIN HISTORY MODAL ── */}
      {showLoginHistory && loginHistoryUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>
                Login History — {loginHistoryUser.username}
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowLoginHistory(false)}>×</button>
            </div>
            <div className="modal-body">
              {loginHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No login history available.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Action</th><th>Description</th><th>IP Address</th><th>Timestamp</th></tr>
                    </thead>
                    <tbody>
                      {loginHistory.map(log => (
                        <tr key={log.id}>
                          <td><span className="badge badge-info">{log.action_type}</span></td>
                          <td style={{ fontSize: '13px' }}>{log.description}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{log.ip_address || '—'}</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLoginHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
