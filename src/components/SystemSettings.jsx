import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Settings, Save, RotateCcw, Building2, DollarSign, Bell, ShieldAlert, CheckCircle2, KeyRound, Lock, Upload, Trash2, Database, HelpCircle, Info, Download } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const apiFetch = (path, opts = {}) => {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
};

const DEFAULTS = {
  organization_name: 'Store Management System',
  organization_logo: '',
  currency: 'USD',
  currency_symbol: '$',
  low_stock_threshold: '5',
  session_timeout: '12',
  date_format: 'MM/DD/YYYY',
  timezone: 'UTC',
  allow_negative_stock: 'false',
  require_approval_stock_out: 'false',
  system_email: '',
  pwd_min_length: '8',
  pwd_require_uppercase: 'true',
  pwd_require_number: 'true',
  pwd_require_special: 'false',
  pwd_expiry_days: '0',
};

// ── Section wrapper ───────────────────────────────────────────
function Section({ icon: Icon, title, color = '#6366f1', children }) {
  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-main)' }}>{title}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────
function Field({ label, span = 1, children }) {
  return (
    <div className="form-group" style={{ gridColumn: `span ${span}` }}>
      <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>{label}</label>
      {children}
    </div>
  );
}

export default function SystemSettings() {
  const { currentUser } = useContext(AuthContext) || {};
  const logoInputRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [activeSection, setActiveSection] = useState('organisation');
  const [original, setOriginal] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [backups, setBackups] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/system/settings');
        if (res.status === 401 || res.status === 403) { setLoading(false); return; }
        if (!res.ok) throw new Error('Failed to load settings from server');
        const data = await res.json();
        // If the server has no system_email saved yet, fall back to the logged-in admin's email
        const adminEmail = currentUser?.email || '';
        const merged = { ...DEFAULTS, system_email: adminEmail, ...data };
        setSettings(merged);
        setOriginal(merged);
      } catch (e) {
        console.warn('System settings:', e.message);
        // Still populate email from currentUser on error
        const adminEmail = currentUser?.email || '';
        setSettings(s => ({ ...s, system_email: s.system_email || adminEmail }));
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  useEffect(() => {
    if (activeSection !== 'backup') return;
    apiFetch('/backups')
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load backups');
        setBackups(Array.isArray(data) ? data : []);
      })
      .catch(e => setError(e.message));
  }, [activeSection]);

  const sectionTabs = [
    { id: 'organisation', label: 'Organisation',       icon: Building2,  desc: 'Organization details, logo, and email settings' },
    { id: 'currency',     label: 'Currency',           icon: DollarSign, desc: 'Currency format and date display settings' },
    { id: 'stock_rules',  label: 'Stock Rules',        icon: Bell,       desc: 'Low stock thresholds and stock flow rules' },
    { id: 'security',     label: 'Session & Security', icon: ShieldAlert,desc: 'Session timeout and security defaults' },
    { id: 'password',     label: 'Password Policy',    icon: KeyRound,   desc: 'Password policy and complexity requirements' },
    { id: 'backup',       label: 'Backup & Data',      icon: Database,   desc: 'Data export and backup management' },
    { id: 'about',        label: 'Help & About',       icon: HelpCircle, desc: 'Version info, help resources, and contact' },
  ];

  const set = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const isDirty = JSON.stringify(settings) !== JSON.stringify(original);

  const handleReset = () => setSettings(original);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select a valid image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Logo image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 300, MAX_HEIGHT = 120;
        let width = img.width, height = img.height;
        if (width > MAX_WIDTH)  { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        if (height > MAX_HEIGHT){ width  = Math.round((width * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
        canvas.width = width; canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        set('organization_logo', canvas.toDataURL('image/png'));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await apiFetch('/system-settings', { method: 'PUT', body: JSON.stringify(settings) });
      if (res.status === 401) throw new Error('Session expired — please log out and log back in');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setOriginal(settings);
      setSavedAt(new Date().toLocaleTimeString());
      window.dispatchEvent(new Event('system_settings_updated'));
      // Refresh backup & audit data if needed

    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setError('');
    setBackupBusy(true);
    try {
      const res = await apiFetch('/backup/export');
      if (!res.ok) throw new Error((await res.json()).error || 'Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `store_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setBackupBusy(false); }
  };

  const handleCreateBackup = async () => {
    setError('');
    setBackupBusy(true);
    try {
      const res = await apiFetch('/backups', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backup failed');
      const list = await apiFetch('/backups');
      setBackups(await list.json());
    } catch (e) { setError(e.message); }
    finally { setBackupBusy(false); }
  };

  const handleRestore = async (backup) => {
    if (!window.confirm(`Restore database backup ${backup.file_name}?`)) return;
    setError('');
    setBackupBusy(true);
    try {
      const res = await apiFetch(`/backups/${backup.id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) { setError(e.message); }
    finally { setBackupBusy(false); }
  };

  const handleDeleteBackup = async (backup) => {
    if (!window.confirm(`Delete backup ${backup.file_name}?`)) return;
    setBackupBusy(true);
    try {
      const res = await apiFetch(`/backups/${backup.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setBackups(items => items.filter(item => item.id !== backup.id));
    } catch (e) { setError(e.message); }
    finally { setBackupBusy(false); }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      const res = await apiFetch(`/backups/${backup.id}/download`);
      if (!res.ok) throw new Error((await res.json()).error || 'Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-muted)', fontSize: '14px', gap: '10px' }}>
        <Settings size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading settings…
      </div>
    );
  }

  return (
    <div className="settings-shell">
      {/* ── Left nav ── */}
      <aside className="settings-nav-panel">
        <div className="settings-nav-heading">Settings Sections</div>
        <div className="settings-nav-list">
          {sectionTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`settings-nav-item${activeSection === tab.id ? ' active' : ''}`}
                onClick={() => setActiveSection(tab.id)}
              >
                <span className="settings-nav-icon"><Icon size={18} /></span>
                <span className="settings-nav-text">
                  <strong>{tab.label}</strong>
                  <span>{tab.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="settings-panel-summary">
          <h3>Quick summary</h3>
          <p>Editing <strong>{sectionTabs.find(t => t.id === activeSection)?.label}</strong>. Use the menu to switch sections.</p>
          <p style={{ marginTop: '12px' }}><strong>Saved status:</strong> {isDirty ? 'Unsaved changes' : savedAt ? `Saved at ${savedAt}` : 'No changes yet'}</p>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="settings-main-panel">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ minWidth: 0, flex: '1 1 400px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Configure organisation details, currency, stock rules, and system behaviour</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {savedAt && !isDirty && (
                <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={13} /> Saved at {savedAt}
                </span>
              )}
              {!isDirty && !savedAt && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No changes to save</span>
              )}
              {isDirty && (
                <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={saving}>
                  <RotateCcw size={15} /> Reset
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || !isDirty}
                title={!isDirty ? 'No changes yet' : 'Save changes'}
              >
                <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* ── Organisation ── */}
          {activeSection === 'organisation' && (
            <Section icon={Building2} title="Organisation" color="#6366f1">
              <Field label="Organisation Name" span={2}>
                <input
                  className="form-input"
                  value={settings.organization_name}
                  onChange={e => set('organization_name', e.target.value)}
                  placeholder="Your organisation name"
                />
              </Field>

              <Field label="Organisation Logo" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '60px', height: '44px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px' }}>
                    {settings.organization_logo
                      ? <img src={settings.organization_logo} alt="Org Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <Building2 size={24} color="#6366f1" />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input type="file" ref={logoInputRef} accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Upload size={13} /> Upload Logo
                      </button>
                      {settings.organization_logo && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('organization_logo', '')} style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Upload PNG or SVG logo for the sidebar &amp; reports</span>
                  </div>
                </div>
              </Field>

              <Field label="System / Notification Email">
                <input
                  className="form-input"
                  type="email"
                  value={settings.system_email}
                  onChange={e => set('system_email', e.target.value)}
                  placeholder={currentUser?.email || 'your-email@example.com'}
                />
              </Field>
              <Field label="Timezone">
                <select className="form-select" value={settings.timezone} onChange={e => set('timezone', e.target.value)}>
                  {['UTC', 'UTC+1', 'UTC+2', 'UTC+3', 'UTC+5:30', 'UTC+7', 'UTC+8', 'UTC+9', 'UTC-5', 'UTC-8'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </Field>
            </Section>
          )}

          {/* ── Currency ── */}
          {activeSection === 'currency' && (
            <Section icon={DollarSign} title="Currency & Formatting" color="#10b981">
              <Field label="Currency Code">
                <select className="form-select" value={settings.currency} onChange={e => {
                  const map = { USD: '$', EUR: '€', GBP: '£', ETB: 'Br', KES: 'KSh', NGN: '₦', GHS: 'GH₵', ZAR: 'R' };
                  set('currency', e.target.value);
                  set('currency_symbol', map[e.target.value] || e.target.value);
                }}>
                  {[['USD','US Dollar'],['EUR','Euro'],['GBP','British Pound'],['ETB','Ethiopian Birr'],['KES','Kenyan Shilling'],['NGN','Nigerian Naira'],['GHS','Ghanaian Cedi'],['ZAR','South African Rand']].map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Currency Symbol">
                <input className="form-input" value={settings.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} placeholder="$" maxLength={5} />
              </Field>
              <Field label="Date Format">
                <select className="form-select" value={settings.date_format} onChange={e => set('date_format', e.target.value)}>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                </select>
              </Field>
            </Section>
          )}

          {/* ── Stock Rules ── */}
          {activeSection === 'stock_rules' && (
            <Section icon={Bell} title="Stock Rules & Alerts" color="#f59e0b">
              <Field label="Low Stock Alert Threshold" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input className="form-input" type="number" min="0" style={{ width: '120px' }} value={settings.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} />
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Items at or below this quantity trigger a low-stock alert</span>
                </div>
              </Field>
              <Field label="Allow Negative Stock" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                  {[['false', 'No — Block stock-out when quantity would go negative'], ['true', 'Yes — Allow stock to go negative']].map(([val, label]) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings.allow_negative_stock === val ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="radio" name="allow_negative_stock" value={val} checked={settings.allow_negative_stock === val} onChange={() => set('allow_negative_stock', val)} style={{ accentColor: '#6366f1' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Require Manager Approval for Stock Out" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                  {[['false', 'No — Storekeeper can issue directly'], ['true', 'Yes — Every stock-out needs Manager approval']].map(([val, label]) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings.require_approval_stock_out === val ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="radio" name="require_approval_stock_out" value={val} checked={settings.require_approval_stock_out === val} onChange={() => set('require_approval_stock_out', val)} style={{ accentColor: '#6366f1' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
            </Section>
          )}

          {/* ── Session / Security ── */}
          {activeSection === 'security' && (
            <Section icon={ShieldAlert} title="Session & Security" color="#ef4444">
              <Field label="JWT Session Timeout (hours)">
                <select className="form-select" value={settings.session_timeout} onChange={e => set('session_timeout', e.target.value)}>
                  {['1', '2', '4', '8', '12', '24', '48'].map(h => (
                    <option key={h} value={h}>{h} hour{h !== '1' ? 's' : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="">
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px', color: '#f87171', marginTop: '22px' }}>
                  Changing session timeout takes effect on next login. Current sessions are not invalidated.
                </div>
              </Field>
            </Section>
          )}

          {/* ── Password Policy ── */}
          {activeSection === 'password' && (
            <Section icon={KeyRound} title="Password Policy" color="#8b5cf6">
              <Field label="Minimum Password Length">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input className="form-input" type="number" min="4" max="32" style={{ width: '100px' }} value={settings.pwd_min_length} onChange={e => set('pwd_min_length', e.target.value)} />
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>characters (min 4)</span>
                </div>
              </Field>
              <Field label="Password Expiry (days)">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input className="form-input" type="number" min="0" max="365" style={{ width: '100px' }} value={settings.pwd_expiry_days} onChange={e => set('pwd_expiry_days', e.target.value)} />
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>0 = never expires</span>
                </div>
              </Field>
              <Field label="Complexity Requirements" span={2}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    ['pwd_require_uppercase', 'Require uppercase letter (A–Z)'],
                    ['pwd_require_number',    'Require number (0–9)'],
                    ['pwd_require_special',   'Require special character (!@#$…)'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings[key] === 'true' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={settings[key] === 'true'} onChange={e => set(key, e.target.checked ? 'true' : 'false')} style={{ accentColor: '#8b5cf6', width: '15px', height: '15px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="" span={2}>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', fontSize: '12px', color: '#a78bfa' }}>
                  <Lock size={12} style={{ display: 'inline', marginRight: '6px' }} />
                  Password policy applies to all new passwords. Existing passwords are not affected until changed.
                </div>
              </Field>
            </Section>
          )}

          {activeSection === 'backup' && (
            <Section icon={Database} title="Backup & Data" color="#0ea5e9">
              <Field label="JSON Data Export" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Export current database records for safekeeping.</span>
                  <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={backupBusy}>
                    <Download size={15} /> Export Data
                  </button>
                </div>
              </Field>
              <Field label="SQL Database Backup" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Create a server-side backup for download or restore.</span>
                  <button type="button" className="btn btn-primary" onClick={handleCreateBackup} disabled={backupBusy}>
                    <Database size={15} /> Create Backup
                  </button>
                </div>
              </Field>
              <Field label="Available Backups" span={2}>
                {backups.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No backups are available.</p>
                ) : backups.map(backup => (
                  <div key={backup.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ fontSize: '13px' }}>{backup.file_name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{backup.created_at ? new Date(backup.created_at).toLocaleString() : 'Date unavailable'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDownloadBackup(backup)} disabled={backupBusy}><Download size={13} /></button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRestore(backup)} disabled={backupBusy}>Restore</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDeleteBackup(backup)} disabled={backupBusy}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </Field>
            </Section>
          )}

          {/* Bottom save bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
            {isDirty && (
              <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={saving}>
                <RotateCcw size={15} /> Discard Changes
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !isDirty}
              title={!isDirty ? 'No changes yet' : 'Save changes'}
            >
              <Save size={15} /> {saving ? 'Saving…' : 'Save All Settings'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
