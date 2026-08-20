import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { LayoutDashboard, Building2, ShoppingCart, HelpCircle, Package, ArrowLeftRight, Users, Truck, FileBarChart, ShieldCheck, LogOut, Database, Bell, Tag, X, MoveRight, Settings, Menu, ClipboardList, Moon, Sun } from 'lucide-react';
const Dashboard = lazy(() => import('./components/Dashboard'));

const WarehouseManager = lazy(() => import('./components/WarehouseManager'));
const ProcurementManager = lazy(() => import('./components/ProcurementManager'));
const HelpSupport = lazy(() => import('./components/HelpSupport'));
const MaterialManager = lazy(() => import('./components/MaterialManager'));
const InventoryTransactions = lazy(() => import('./components/InventoryTransactions'));
const EmployeeDeptManager = lazy(() => import('./components/EmployeeDeptManager'));
const SupplierManager = lazy(() => import('./components/SupplierManager'));
const ReportsCenter = lazy(() => import('./components/ReportsCenter'));
const UserAndAuditManager = lazy(() => import('./components/UserAndAuditManager'));
const CategoryManager = lazy(() => import('./components/CategoryManager'));
const StockTransfers = lazy(() => import('./components/StockTransfers'));
const SystemSettings = lazy(() => import('./components/SystemSettings'));
const MaterialRequests = lazy(() => import('./components/MaterialRequests'));
import UserProfileModal from './components/UserProfileModal';
import LoginModal from './components/LoginModal';
import AccessDenied from './components/AccessDenied';
import UserAvatar from './components/UserAvatar';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// ── Auth token helpers ────────────────────────────────────────
const getToken = () => localStorage.getItem('auth_token');
const setToken = (t) => localStorage.setItem('auth_token', t);
const clearToken = () => localStorage.removeItem('auth_token');

// Authenticated fetch — attaches Bearer token to every request
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeNav, setActiveNav] = useState('DASHBOARD');
  const [showBell, setShowBell] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sms_theme') === 'dark');
  const bellRef = useRef(null);

  // Application data
  const [stats, setStats] = useState({});
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [disposals, setDisposals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [dbStatus, setDbStatus] = useState('Connecting...');
  const [usingFallback, setUsingFallback] = useState(false);
  const [apiError, setApiError] = useState(false); // true when server is unreachable
  const [apiErrorMessage, setApiErrorMessage] = useState('');
  const [retryCountdown, setRetryCountdown] = useState(10);
  const retryIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sessionExpiring, setSessionExpiring] = useState(false);
  const [clockTime, setClockTime] = useState(() => new Date());
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const clearLiveData = () => {
    setStats({});
    setMaterials([]); setCategories([]); setSuppliers([]); setEmployees([]);
    setTransactions([]); setTransfers([]); setDisposals([]); setAuditLogs([]); setUsersList([]);
    setSystemSettings({});
  };

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('sms_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const handleOutsideBellClick = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) setShowBell(false);
    };
    document.addEventListener('mousedown', handleOutsideBellClick);
    return () => document.removeEventListener('mousedown', handleOutsideBellClick);
  }, []);

  const fetchSystemSettings = async () => {
    if (!getToken()) return;
    try {
      const res = await apiFetch('/system-settings');
      if (res.ok) {
        const data = await res.json();
        setSystemSettings(data);
      }
    } catch (e) {
      console.warn('Could not fetch system settings:', e.message);
    }
  };

  // On mount: restore session from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    const savedToken = getToken();
    if (savedToken) {
      setIsLoggedIn(true);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
      } else {
        fetchCurrentUser();
      }
      clearLiveData();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('system_settings_updated', fetchSystemSettings);
    return () => window.removeEventListener('system_settings_updated', fetchSystemSettings);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (isLoggedIn) fetchData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isLoggedIn]);

  useEffect(() => {
    const handleAuthLogout = () => {
      setCurrentUser(null);
      setIsLoggedIn(false);
      clearToken();
      localStorage.removeItem('current_user');
    };
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);


  useEffect(() => {
    const t = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-retry: when server goes offline, poll every 10 s and reconnect automatically
  useEffect(() => {
    if (apiError && isLoggedIn) {
      // Start countdown display
      setRetryCountdown(10);
      countdownRef.current = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) return 10;
          return prev - 1;
        });
      }, 1000);

      // Retry fetchData every 10 seconds
      retryIntervalRef.current = setInterval(() => {
        fetchData();
      }, 10000);
    } else {
      // Server is back — clear all timers
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    return () => {
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [apiError, isLoggedIn]);

  // Fetch the currently authenticated user's full profile (including avatar)
  const fetchCurrentUser = async () => {
    try {
      const res = await apiFetch('/users/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        localStorage.setItem('current_user', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Could not fetch current user profile:', e.message);
    }
  };

  const handleNavSelection = (id) => {
    setActiveNav(id);
    // Close sidebar on mobile only
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const toggleSidebar = () => setSidebarOpen(value => !value);

  // Fetch all data — uses auth token on every call
  const fetchData = async () => {
    if (!getToken()) return;
    try {
      fetchSystemSettings();
      // First check if server is reachable using authenticated request
      const statusRes = await apiFetch('/system/status').catch((err) => {
        setApiErrorMessage(err?.message || 'Unable to reach backend server');
        return null;
      });
      if (!statusRes || !statusRes.ok) {
        let message = 'Backend server is not reachable';
        if (statusRes) {
          try {
            const errBody = await statusRes.json();
            message = errBody?.error || errBody?.message || `${statusRes.status} ${statusRes.statusText}`.trim();
          } catch {
            message = `${statusRes.status} ${statusRes.statusText}`.trim();
          }
        }
        setApiError(true);
        setApiErrorMessage(message || 'Backend server is not reachable');
        setDbStatus('Server Offline - live data unavailable');
        clearLiveData();
        return;
      }
      const statusData = await statusRes.json();
      setUsingFallback(Boolean(statusData.usingFallback));
      setDbStatus(statusData.usingFallback ? 'Resilient Local Mode' : 'MySQL Connected');

      const endpoints = [
        apiFetch('/dashboard/stats'),
        apiFetch('/materials'),
        apiFetch('/categories'),
        apiFetch('/suppliers'),
        apiFetch('/employees'),
        apiFetch('/transactions'),
        apiFetch('/transfers'),
        apiFetch('/disposals'),
        apiFetch('/audit-logs'),
        apiFetch('/users'),
      ];

      const results = await Promise.allSettled(endpoints.map(p => p.then(r => r.json())));
      const values = results.map(result => result.status === 'fulfilled' ? result.value : null);
      const [resStats, resMats, resCats, resSups, resEmps, resTxs, resTrfs, resDisps, resLogs, resUsers] = values;

      setApiError(false); // server is back
      setApiErrorMessage('');
      if (resStats && !resStats.error) setStats(resStats);
      if (Array.isArray(resMats)) setMaterials(resMats);
      if (Array.isArray(resCats)) setCategories(resCats);
      if (Array.isArray(resSups)) setSuppliers(resSups);
      if (Array.isArray(resEmps)) setEmployees(resEmps);
      // Paginated responses return { data, total, page, limit }
      if (resTxs?.data)  setTransactions(resTxs.data);
      else if (Array.isArray(resTxs)) setTransactions(resTxs);
      if (resTrfs?.data) setTransfers(resTrfs.data);
      else if (Array.isArray(resTrfs)) setTransfers(resTrfs);
      if (resDisps?.data) setDisposals(resDisps.data);
      else if (Array.isArray(resDisps)) setDisposals(resDisps);
      if (resLogs?.data) setAuditLogs(resLogs.data);
      else if (Array.isArray(resLogs)) setAuditLogs(resLogs);
      if (Array.isArray(resUsers)) setUsersList(resUsers);
    } catch (e) {
      console.warn('API fetch error:', e.message);
      setApiError(true);
      setApiErrorMessage(e.message || 'Unknown API error');
      setDbStatus('Server Offline - live data unavailable');
      clearLiveData();
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const token = getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const warnAt = expiresAt - 5 * 60 * 1000; // 5 min before expiry
      const now = Date.now();
      if (now >= expiresAt) {
        handleLogout();
        return;
      }
      const warnTimeout = setTimeout(() => setSessionExpiring(true), Math.max(0, warnAt - now));
      const logoutTimeout = setTimeout(() => handleLogout(), Math.max(0, expiresAt - now));
      return () => { clearTimeout(warnTimeout); clearTimeout(logoutTimeout); };
    } catch { /* ignore malformed token */ }
  }, [isLoggedIn]);

  // ── Auth handlers ──────────────────────────────────────────
  const handleLogin = async (username, password, callback) => {
    username = username?.trim ? username.trim() : username;
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (res.ok && data.user && data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem('current_user', JSON.stringify(data.user));
        setIsLoggedIn(true);
        fetchCurrentUser();
        fetchData();
        callback(null);
      } else if (data?.require_password_change && data?.user_id) {
        // New user — must set a new password before logging in
        callback(null, { requirePasswordChange: true, userId: data.user_id });
      } else {
        const message = data?.error || data?.message || `Login failed (${res.status})`;
        callback(message);
      }
    } catch (e) {
      callback(e.message || 'Could not reach the backend server');
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('current_user');
    setCurrentUser(null);
    setIsLoggedIn(false);
    setMaterials([]); setTransactions([]); setTransfers([]);
    setDisposals([]); setAuditLogs([]); setUsersList([]); setStats({});
  };

  // ── API action handlers (all use apiFetch with auth token) ──
  const handleAddMaterial = async (matData) => {
    try {
      await apiFetch('/materials', { method: 'POST', body: JSON.stringify(matData) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleEditMaterial = async (id, matData) => {
    try {
      await apiFetch(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(matData) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      await apiFetch(`/materials/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleStockIn = async (data) => {
    try {
      await apiFetch('/inventory/stock-in', { method: 'POST', body: JSON.stringify(data) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleStockOut = async (data) => {
    try {
      await apiFetch('/inventory/stock-out', { method: 'POST', body: JSON.stringify(data) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleReturn = async (data) => {
    try {
      await apiFetch('/inventory/return', { method: 'POST', body: JSON.stringify(data) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAdjust = async (data) => {
    try {
      await apiFetch('/inventory/adjust', { method: 'POST', body: JSON.stringify(data) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleTransfer = async (data) => {
    try {
      const res = await apiFetch('/transfers', { method: 'POST', body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      fetchData();
      return null;
    } catch (e) { return e.message; }
  };

  const handleAddEmployee = async (empData) => {
    try {
      await apiFetch('/employees', { method: 'POST', body: JSON.stringify(empData) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAddSupplier = async (supData) => {
    try {
      await apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(supData) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAddUser = async (userData) => {
    try {
      const res = await apiFetch('/users', { method: 'POST', body: JSON.stringify(userData) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || data?.message || `Unable to create user (${res.status})`;
        return message;
      }
      fetchData();
      return null;
    } catch (e) {
      console.error(e);
      return e.message || 'Unable to reach backend server';
    }
  };

  const handleAvatarChange = async (dataUrl) => {
    // Called from Dashboard hero upload — dataUrl is already resized base64
    if (!currentUser || !dataUrl || !dataUrl.startsWith('data:image/')) return;
    try {
      let res;
      try {
        res = await apiFetch('/auth/upload-avatar', {
          method: 'POST',
          body: JSON.stringify({ avatar_data_url: dataUrl }),
        });
      } catch {
        // Network error — silently ignore, do not log out
        return;
      }
      let data = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (res.ok && data.avatar_url) {
        // Use the server-saved file URL (e.g. /avatars/avatar_1_1234.jpg)
        const updatedUser = { ...currentUser, avatar_url: data.avatar_url, ...(data.user || {}) };
        setCurrentUser(updatedUser);
        localStorage.setItem('current_user', JSON.stringify(updatedUser));
      }
    } catch {
      // Catch-all — never propagate, never log out
    }
  };

  if (!isLoggedIn) {
    return <LoginModal onLogin={handleLogin} />;
  }

  // ── Role-based navigation ──────────────────────────────────
  const getAccessibleNavItems = (role) => {
    const all = [
      { id: 'DASHBOARD',   label: 'Dashboard',           icon: LayoutDashboard, roles: ['Administrator', 'Store Manager', 'Storekeeper', 'Auditor', 'Viewer'] },
      { id: 'MATERIALS',   label: 'Material Registry',   icon: Package,         roles: ['Administrator', 'Store Manager', 'Storekeeper', 'Auditor', 'Viewer'] },
      { id: 'TRANSACTIONS',label: 'Stock Movements',     icon: ArrowLeftRight,  roles: ['Administrator', 'Store Manager', 'Storekeeper', 'Auditor', 'Viewer'] },
      { id: 'REQUESTS',    label: 'Material Requests',   icon: ClipboardList,   roles: ['Administrator', 'Store Manager', 'Storekeeper', 'Auditor', 'Viewer'] },
      { id: 'TRANSFERS',   label: 'Stock Transfers',     icon: MoveRight,       roles: ['Administrator', 'Store Manager', 'Storekeeper', 'Auditor'] },
      { id: 'EMPLOYEES',   label: 'Employees / Depts',   icon: Users,           roles: ['Administrator', 'Store Manager', 'Storekeeper'] },
      { id: 'SUPPLIERS',   label: 'Suppliers',           icon: Truck,           roles: ['Administrator', 'Store Manager'] },
      { id: 'CATEGORIES',  label: 'Categories',          icon: Tag,             roles: ['Administrator', 'Store Manager'] },
      { id: 'WAREHOUSES',  label: 'Warehouses',          icon: Building2,       roles: ['Administrator', 'Store Manager'] },
      { id: 'PROCUREMENT', label: 'Purchase Orders',     icon: ShoppingCart,    roles: ['Administrator', 'Store Manager'] },
      { id: 'HELP',        label: 'Help & Support',      icon: HelpCircle,      roles: ['Administrator', 'Store Manager', 'Storekeeper', 'Auditor', 'Viewer'] },

      { id: 'REPORTS',     label: 'Reporting Center',    icon: FileBarChart,    roles: ['Administrator', 'Store Manager', 'Auditor', 'Storekeeper'] },
      { id: 'USERS_AUDIT', label: 'User Roles & Audits', icon: ShieldCheck,     roles: ['Administrator', 'Store Manager', 'Auditor'] },
      { id: 'SETTINGS',    label: 'System Settings',     icon: Settings,        roles: ['Administrator'] },
    ];
    return all.filter(item => item.roles.includes(role));
  };

  const navItems = getAccessibleNavItems(currentUser?.role || 'Storekeeper');
  const isReadOnly = currentUser?.role === 'Auditor' || currentUser?.role === 'Viewer';
  const lowStockItems = materials.filter((material) => Number(material.current_stock) <= Number(material.min_stock_level));

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <img
            src={systemSettings.organization_logo || '/logo.jpg'}
            alt="Logo"
            className="sidebar-logo"
          />
          <div className="sidebar-brand-info">
            <h1>{systemSettings.organization_name || 'Store Management'}</h1>
            <span>Store Management System</span>
          </div>
        </div>

        <div className="sidebar-profile-card sidebar-profile-top">
          <div className="sidebar-profile-avatar">
            <UserAvatar user={currentUser} size={62} key={currentUser?.avatar_url || 'no-avatar'} />
          </div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{currentUser?.full_name || currentUser?.username}</div>
            <div className="sidebar-profile-role">{currentUser?.role || 'User'}</div>
            <span className="sidebar-profile-status">Online</span>
          </div>
        </div>

        <div className="sidebar-section-title">Navigation</div>
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavSelection(item.id)}
                className={`nav-button${isActive ? ' active' : ''}`}
              >
                <Icon size={18} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {isReadOnly && (
          <div className="sidebar-warning">
            Read-Only Mode ({currentUser?.role})
          </div>
        )}

        <div className="sidebar-status">
          <div className={`status-pill ${apiError ? 'status-error' : usingFallback ? 'status-warning' : 'status-ok'}`}>
            <Database size={14} />
            <span>{dbStatus}</span>
          </div>
          {apiError && (
            <button className="btn btn-sm status-retry" onClick={() => fetchData()} title="Retry connecting">
              Retry
            </button>
          )}
        </div>
      </aside>

      <div className={window.innerWidth < 1024 && sidebarOpen ? "mobile-overlay active" : "mobile-overlay"} onClick={() => setSidebarOpen(false)} />

      <div className="app-content">
        <header className="app-bar">
          <button
            type="button"
            className="app-bar-toggle"
            onClick={toggleSidebar}
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
          >
            <Menu size={20} color="#000" />
          </button>

          <div style={{ flex: 1 }} />

          <div className="app-bar-actions">
            <button
              className="btn btn-icon"
              onClick={() => fetchData()}
              title="Refresh all data"
            >
              <Database size={18} color={apiError ? '#000' : '#000'} />
            </button>

            <button
              className="btn btn-icon"
              onClick={() => setDarkMode(value => !value)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} color="#000" /> : <Moon size={18} color="#000" />}
            </button>

            {/* Digital Clock */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '6px 16px', borderRadius: '10px', minWidth: '155px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(99,102,241,0.08))',
              border: '1px solid rgba(99,102,241,0.3)',
              lineHeight: 1.15,
            }}>
              <span style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '20px', fontWeight: '800', letterSpacing: '2px',
                color: '#4f46e5',
              }}>
                {clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
              <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: '600', letterSpacing: '0.5px', marginTop: '2px' }}>
                {clockTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div className="relative" ref={bellRef}>
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => setShowBell(value => !value)}
                title="Low stock alerts"
                aria-label="Low stock alerts"
                aria-expanded={showBell}
              >
                <Bell size={18} color="#000" />
              </button>
              {lowStockItems.length > 0 && (
                <span className="badge" style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', borderRadius: '50%', padding: '0', fontSize: '10px', background: '#fff', color: '#000' }}>
                  {lowStockItems.length}
                </span>
              )}
              {showBell && (
                <div className="low-stock-panel" role="dialog" aria-label="Low stock alerts">
                  <div className="low-stock-panel-header">
                    <span>Low Stock Alerts</span>
                    <span className="low-stock-count">{lowStockItems.length}</span>
                  </div>
                  <div className="low-stock-list">
                    {lowStockItems.length === 0 ? (
                      <div className="low-stock-empty">All materials are sufficiently stocked.</div>
                    ) : lowStockItems.map((material) => (
                      <div className="low-stock-item" key={material.id}>
                        <div>
                          <div className="low-stock-name">{material.name}</div>
                          <div className="low-stock-meta">Minimum: {material.min_stock_level} {material.unit_of_measure || 'units'}</div>
                        </div>
                        <span className="low-stock-count">{material.current_stock}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className="user-chip" onClick={() => setShowProfileModal(true)} title="My Account">
              <UserAvatar user={currentUser} size={32} key={currentUser?.avatar_url || 'no-avatar'} />
              <div className="user-chip-text">
                <div>{currentUser?.full_name}</div>
                <div>{currentUser?.role}</div>
              </div>
            </button>

            <button className="btn btn-icon" onClick={handleLogout} title="Sign Out" style={{width:'auto',padding:'0 14px',gap:'6px',fontSize:'0.8125rem'}}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </header>

        <main className="app-main">
          {/* ── Session expiring warning banner ── */}
          {sessionExpiring && (
            <div style={{
              marginBottom: '12px', padding: '12px 20px', borderRadius: '10px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <span style={{ fontSize: '18px' }}>⏰</span>
              <span style={{ flex: 1, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                Your session is about to expire. Save your work and sign in again to continue.
              </span>
              <button className="btn btn-sm" onClick={handleLogout} style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#92400e' }}>
                Sign In Again
              </button>
            </div>
          )}
          {/* ── Server offline banner ── */}
        {apiError && (
          <div style={{
            marginBottom: '20px', padding: '14px 20px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap'
          }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', color: '#ef4444', fontSize: '14px' }}>
                Backend server is not reachable
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Start the server: open a terminal in the project folder and run{' '}
                <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>node server/index.js</code>
                {' '}— auto-reconnecting in {retryCountdown}s
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => { setRetryCountdown(10); fetchData(); }}
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', flexShrink: 0 }}
            >
              ↻ Retry Now
            </button>
          </div>
        )}
        {activeNav !== 'DASHBOARD' && (
          <header className="page-header">
            <h2 className="page-title">{navItems.find(n => n.id === activeNav)?.label || activeNav}</h2>
          </header>
        )}

        {/* ── Page Router ── */}
        {activeNav === 'WAREHOUSES' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading...</div>}>
            <WarehouseManager />
          </Suspense>
        )}

        {activeNav === 'PROCUREMENT' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading...</div>}>
            <ProcurementManager />
          </Suspense>
        )}

        {activeNav === 'HELP' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading...</div>}>
            <HelpSupport />
          </Suspense>
        )}

        {activeNav === 'DASHBOARD' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading...</div>}>
            <Dashboard
              stats={stats}
              materials={materials}
              transactions={transactions}
              currentUser={currentUser}
              onQuickStockIn={() => setActiveNav('TRANSACTIONS')}
              onQuickStockOut={() => setActiveNav('TRANSACTIONS')}
              onOpenRequests={() => setActiveNav('REQUESTS')}
              onOpenTransfers={() => setActiveNav('TRANSFERS')}
              onOpenProfile={() => setShowProfileModal(true)}
            />
          </Suspense>
        )}

        {activeNav === 'MATERIALS' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Materials...</div>}>
            <MaterialManager
              materials={materials}
              categories={categories}
              suppliers={suppliers}
              currentUser={currentUser}
              onAddMaterial={handleAddMaterial}
              onEditMaterial={handleEditMaterial}
              onDeleteMaterial={handleDeleteMaterial}
            />
          </Suspense>
        )}

        {activeNav === 'TRANSACTIONS' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Transactions...</div>}>
            <InventoryTransactions
              materials={materials}
              suppliers={suppliers}
              employees={employees}
              transactions={transactions}
              disposals={disposals}
              currentUser={currentUser}
              onStockIn={handleStockIn}
              onStockOut={handleStockOut}
              onReturn={handleReturn}
              onAdjust={handleAdjust}
              onRefresh={fetchData}
            />
          </Suspense>
        )}

        {activeNav === 'REQUESTS' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Requests...</div>}>
            <MaterialRequests />
          </Suspense>
        )}

        {activeNav === 'TRANSFERS' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Transfers...</div>}>
            {currentUser?.role === 'Auditor' ? (
              <StockTransfers
                transfers={transfers}
                materials={materials}
                currentUser={currentUser}
                readOnly
              />
            ) : (
              <StockTransfers
                transfers={transfers}
                materials={materials}
                currentUser={currentUser}
                onTransfer={handleTransfer}
                onRefresh={fetchData}
              />
            )}
          </Suspense>
        )}

        {activeNav === 'EMPLOYEES' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Employees...</div>}>
            {['Administrator', 'Store Manager', 'Storekeeper'].includes(currentUser?.role) ? (
              <EmployeeDeptManager
                employees={employees}
                transactions={transactions}
                currentUser={currentUser}
                onAddEmployee={handleAddEmployee}
                onRefresh={fetchData}
              />
            ) : (
              <AccessDenied feature="Employees / Departments" requiredRole="Administrator, Store Manager, or Storekeeper" currentRole={currentUser?.role} />
            )}
          </Suspense>
        )}

        {activeNav === 'SUPPLIERS' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Suppliers...</div>}>
            {['Administrator', 'Store Manager'].includes(currentUser?.role) ? (
              <SupplierManager
                suppliers={suppliers}
                materials={materials}
                currentUser={currentUser}
                onAddSupplier={handleAddSupplier}
                onRefresh={fetchData}
              />
            ) : (
              <AccessDenied feature="Supplier Management" requiredRole="Administrator or Store Manager" currentRole={currentUser?.role} />
            )}
          </Suspense>
        )}

        {activeNav === 'CATEGORIES' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Categories...</div>}>
            {['Administrator', 'Store Manager'].includes(currentUser?.role) ? (
              <CategoryManager categories={categories} currentUser={currentUser} onRefresh={fetchData} />
            ) : (
              <AccessDenied feature="Category Management" requiredRole="Administrator or Store Manager" currentRole={currentUser?.role} />
            )}
          </Suspense>
        )}

        {activeNav === 'REPORTS' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Reports...</div>}>
            <ReportsCenter
              materials={materials}
              categories={categories}
              transactions={transactions}
              suppliers={suppliers}
              employees={employees}
              currentUser={currentUser}
            />
          </Suspense>
        )}
        {activeNav === 'USERS_AUDIT' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading User Management...</div>}>
            <UserAndAuditManager
              users={usersList}
              auditLogs={auditLogs}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onRefresh={fetchData}
              readOnly={currentUser?.role === 'Auditor'}
            />
          </Suspense>
        )}
        {activeNav === 'SETTINGS' && (
          <Suspense fallback={<div className="loading-spinner" style={{padding: '40px', textAlign: 'center'}}>Loading Settings...</div>}>
            {currentUser?.role === 'Administrator' ? (
              <SystemSettings currentUser={currentUser} />
            ) : (
              <AccessDenied feature="System Settings" requiredRole="Administrator" currentRole={currentUser?.role} />
            )}
          </Suspense>
        )}
      </main>
      {/* Profile / Change Password Modal */}
      {showProfileModal && (
        <UserProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={(updated) => {
            setCurrentUser(updated);
            localStorage.setItem('current_user', JSON.stringify(updated));
          }}
        />
      )}
    </div>
  </div>
  );
}





