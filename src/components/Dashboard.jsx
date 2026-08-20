import React, { useState, useEffect, useContext, useCallback } from 'react';
import { API_BASE } from '../utils/apiFetch';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { sanitizeText, sanitizeNumber } from '../utils/displayValue';
import {
  Search, ArrowUpRight,
  TrendingUp, ShoppingBag, Store, Trophy, Star, Shirt, Laptop,
  ShoppingCart, Footprints, BookOpen, Grid, Truck,
  ChevronDown, ArrowDownLeft, AlertTriangle, PackageX, ClipboardList, MoveRight
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';

/* ── Vector Illustration of Businessman holding tablet ── */
function HeroBusinessmanIllustration() {
  return (
    <svg width="140" height="140" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="80" cy="80" r="72" fill="#e0f2fe" opacity="0.6" />
      <circle cx="80" cy="80" r="54" fill="#bae6fd" opacity="0.4" />
      <path d="M52 45C52 32 64 22 80 22C96 22 108 32 108 45V55H52V45Z" fill="#451a03" />
      <path d="M60 48C60 40 69 34 80 34C91 34 100 40 100 48V62C100 73 91 82 80 82C69 82 60 73 60 62V48Z" fill="#fdba74" />
      <path d="M56 46C56 34 68 24 80 24C92 24 102 34 100 46C95 40 86 38 80 38C72 38 62 42 56 46Z" fill="#292524" />
      <circle cx="73" cy="54" r="2.5" fill="#1c1917" />
      <circle cx="87" cy="54" r="2.5" fill="#1c1917" />
      <path d="M70 49Q73 47 76 49" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M84 49Q87 47 90 49" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M74 66Q80 72 86 66" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 78L80 92L90 78" fill="#ffffff" />
      <path d="M78 84L82 84L84 108L80 114L76 108Z" fill="#2563eb" />
      <path d="M42 98C42 86 54 80 68 78L78 112H42V98Z" fill="#57534e" />
      <path d="M118 98C118 86 106 80 92 78L82 112H118V98Z" fill="#57534e" />
      <path d="M44 98L62 120H98L116 98" stroke="#44403c" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="52" y="104" width="56" height="42" rx="4" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
      <rect x="55" y="107" width="50" height="36" rx="2" fill="#0f172a" />
      <path d="M58 132L68 122L76 127L90 115L102 124" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="90" cy="115" r="2" fill="#60a5fa" />
      <rect x="58" y="110" width="16" height="3" rx="1.5" fill="#38bdf8" opacity="0.8" />
      <rect x="58" y="115" width="24" height="2" rx="1" fill="#94a3b8" opacity="0.6" />
    </svg>
  );
}

/* ── Custom Light Tooltip ── */
const CustomChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '10px 14px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
      fontSize: '12px'
    }}>
      <p style={{ color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: p.color, fontWeight: '700', margin: '2px 0' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
          <span>{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard({ onQuickStockIn, onQuickStockOut, onOpenRequests, onOpenTransfers }) {
  const { stats = {}, materials = [], transactions = [] } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};
  
  // onQuickStockIn and onQuickStockOut can just navigate or be removed, as the Dashboard can link to routes.
  const navigate = window.location; // simple fallback if react-router isn't imported
  
  // Defensive array and object handling to prevent ANY runtime crash
  const safeMaterials = Array.isArray(materials) ? materials : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeStats = stats || {};

  const totalMaterialsCount = Number(safeStats.totalMaterials ?? safeMaterials.length ?? 0);
  const pendingOrdersCount = Number(safeStats.pendingOrders ?? 0);
  const departmentsCount = Number(safeStats.departments ?? 0);
  const vendorMeetingsCount = Number(safeStats.vendorMeetings ?? 0);
  const totalInventoryValue = safeMaterials.reduce((sum, mat) => sum + (sanitizeNumber(mat.current_stock) * sanitizeNumber(mat.unit_cost)), 0);
  const lowStockItems = safeMaterials.filter((mat) => sanitizeNumber(mat.current_stock) <= sanitizeNumber(mat.min_stock_level));
  const lowStockCount = Number(safeStats.lowStockCount ?? lowStockItems.length ?? 0);
  const stockHealthPercent = totalMaterialsCount > 0 ? Math.round(((totalMaterialsCount - lowStockCount) / totalMaterialsCount) * 100) : 0;
  const safeTotalStock = safeMaterials.reduce((sum, mat) => sum + sanitizeNumber(mat.current_stock), 0);

  // ── New computed metrics ──────────────────────────────────
  const outOfStockCount = safeMaterials.filter(m => sanitizeNumber(m.current_stock) === 0).length;

  // Most-issued materials (aggregate stock-out transactions by material)
  const issuedByMaterial = {};
  safeTransactions.forEach(tx => {
    if (tx.transaction_type === 'STOCK_OUT') {
      const key = tx.material_name || tx.material_code || `#${tx.material_id}`;
      issuedByMaterial[key] = (issuedByMaterial[key] || 0) + sanitizeNumber(tx.quantity);
    }
  });
  const mostIssuedMaterials = Object.entries(issuedByMaterial)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Monthly stock movement — last 6 months aggregated from transactions
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const inQty  = safeTransactions.filter(t => t.transaction_type === 'STOCK_IN'  && (t.transaction_date || '').startsWith(monthStr)).reduce((s, t) => s + sanitizeNumber(t.quantity), 0);
    const outQty = safeTransactions.filter(t => t.transaction_type === 'STOCK_OUT' && (t.transaction_date || '').startsWith(monthStr)).reduce((s, t) => s + sanitizeNumber(t.quantity), 0);
    return { label, in: inQty, out: outQty };
  });

  const categoryStats = Array.isArray(safeStats.categoryStats) ? safeStats.categoryStats : [];
  const donutPalette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];
  const donutData = categoryStats.length
    ? categoryStats
        .filter((entry) => Number(entry.stock_qty || 0) > 0)
        .slice(0, 5)
        .map((entry, index) => ({
          name: sanitizeText(entry.category, 'Uncategorized'),
          value: Number(entry.stock_qty || 0),
          color: donutPalette[index % donutPalette.length],
        }))
    : safeMaterials.slice(0, 5).map((mat, index) => ({
        name: sanitizeText(mat.name, 'Unknown'),
        value: sanitizeNumber(mat.current_stock),
        color: donutPalette[index % donutPalette.length],
      }));

  const inventoryChartData = safeMaterials
    .slice(0, 6)
    .map((mat) => ({
      name: sanitizeText(mat.name, 'Unknown').slice(0, 10),
      stock: sanitizeNumber(mat.current_stock),
      revenue: sanitizeNumber(mat.current_stock) * sanitizeNumber(mat.unit_cost),
    }));

  const recentTransactions = Array.isArray(safeTransactions)
    ? safeTransactions
        .slice()
        .sort((a, b) => new Date(b.transaction_date || b.created_at || 0) - new Date(a.transaction_date || a.created_at || 0))
        .slice(0, 5)
    : [];

  const topInventoryByValue = safeMaterials
    .map((mat) => ({
      name: sanitizeText(mat.name, 'Unknown'),
      value: sanitizeNumber(mat.current_stock) * sanitizeNumber(mat.unit_cost),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const userName = currentUser?.full_name?.trim().split(' ')[0] || currentUser?.username || '';
  const hour = currentTime.getHours();
  const timeGreeting = hour >= 5 && hour < 12
    ? 'Morning'
    : hour >= 12 && hour < 17
      ? 'Afternoon'
      : hour >= 17 && hour < 21
        ? 'Evening'
        : 'Night';

  return (
    <div className="dashboard-wrapper">

      {/* ── TOP HERO ROW: HERO BANNER + AI ASSISTANT WIDGET ── */}
      <div className="dashboard-hero-section">
        <div className="hero-banner-card">
          <div className="hero-banner-left">
            <div className="hero-avatar-upload-area">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="Profile" className="hero-profile-img" />
              ) : (
                <HeroBusinessmanIllustration />
              )}
            </div>
          </div>
          <div className="hero-banner-content">
            <div className="hero-heading-row">
              <h2>Good {timeGreeting}{userName ? `, ${userName}` : ''}!</h2>
              <div className="hero-search-wrap">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search"
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  aria-label="Search unavailable"
                />
              </div>
            </div>
            <div className="hero-summary-row">
              <div className="mini-stat-box green-box">
                <span className="mini-stat-value">{totalMaterialsCount}</span>
                <span className="mini-stat-label">Total Products</span>
              </div>
              <div className="mini-stat-box soft-box">
                <span className="mini-stat-value">{pendingOrdersCount}</span>
                <span className="mini-stat-label">Pending Orders</span>
              </div>
              <div className="mini-stat-box green-box">
                <span className="mini-stat-value">{safeTotalStock}</span>
                <span className="mini-stat-label">Total Stock</span>
              </div>
              <div className="mini-stat-box peach-box">
                <span className="mini-stat-value">{lowStockCount}</span>
                <span className="mini-stat-label">Low Stock</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ROW (5 horizontal cards) ── */}
      <div className="kpi-cards-grid">
        {/* Card 1: Total Inventory Value */}
        <div className="kpi-flat-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-box purple-bg">
              <ShoppingBag size={20} color="#8b5cf6" />
            </div>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Inventory Value</p>
            <h3 className="kpi-value">{new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(totalInventoryValue)}</h3>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-footnote">Current stock value</span>
            <span className="kpi-sub-footnote">{safeMaterials.length} items</span>
          </div>
        </div>

        {/* Card 2: Active Inventory */}
        <div className="kpi-flat-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-box green-bg">
              <TrendingUp size={20} color="#10b981" />
            </div>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Stock Health</p>
            <h3 className="kpi-value">{stockHealthPercent}%</h3>
          </div>
          <div className="kpi-footer-row align-center">
            <span className="kpi-footnote">Healthy stock</span>
            <span className="pill-badge-healthy">{safeMaterials.reduce((sum, mat) => sum + (Number(mat.current_stock) || 0), 0)} units</span>
          </div>
        </div>

        {/* Card 3: Departments */}
        <div className="kpi-flat-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-box purple-light-bg">
              <Store size={20} color="#a855f7" />
            </div>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Departments</p>
            <h3 className="kpi-value">{departmentsCount}</h3>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-footnote">Active departments</span>
          </div>
        </div>

        {/* Card 4: Pending Orders */}
        <div className="kpi-flat-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-box yellow-bg">
              <Trophy size={20} color="#f59e0b" />
            </div>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Pending Requests</p>
            <h3 className="kpi-value">{pendingOrdersCount}</h3>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-footnote">Awaiting approval</span>
          </div>
        </div>

        {/* Card 5: Out of Stock */}
        <div className="kpi-flat-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-box" style={{ background: 'rgba(255,65,58,0.12)' }}>
              <PackageX size={20} color="#ff413a" />
            </div>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Out of Stock</p>
            <h3 className="kpi-value" style={{ color: outOfStockCount > 0 ? '#ff413a' : undefined }}>{outOfStockCount}</h3>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-footnote">{outOfStockCount > 0 ? 'Need immediate restocking' : 'All items in stock'}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN DASHBOARD 3-COLUMN LAYOUT ── */}
      <div className="dash-main-columns-grid">

        {/* ── LEFT COLUMN ── */}
        <div className="dash-column left-column">
          
          {/* Card: Sales Channel Breakdown */}
          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Stock by Category</h4>
              <button type="button" className="view-all-link">View All</button>
            </div>
            
            <div className="donut-chart-container">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Label */}
              <div className="donut-center-label">
                <span className="donut-amount">{donutData.reduce((s, d) => s + d.value, 0).toLocaleString()}</span>
                <span className="donut-sub">Total stock units</span>
              </div>
            </div>

            <div className="donut-legend-row">
              {donutData.map((d, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: d.color }} />
                  <span>{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Exam / Inventory Schedule */}
          <div className="parallel-cards">
  <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Recent stock activity</h4>
              <button type="button" className="view-all-link">View all</button>
            </div>

            <div className="schedule-list">
              {recentTransactions.length > 0 ? recentTransactions.map((item, index) => (
                <div key={`${item.transaction_code || item.id || index}`} className="schedule-item">
                  <div className="schedule-date-badge">
                    <span className="sched-month">{new Date(item.transaction_date || item.created_at || Date.now()).toLocaleString('en-US', { month: 'short' })}</span>
                    <span className="sched-day">{new Date(item.transaction_date || item.created_at || Date.now()).getDate()}</span>
                  </div>
                  <div className="schedule-info">
                    <h5 className="sched-title">{sanitizeText(item.transaction_code, 'Transaction')}</h5>
                    <p className="sched-subtitle">{sanitizeText(item.transaction_type, 'Stock movement')} • {sanitizeText(item.purpose, 'Stock movement')}</p>
                  </div>
                  <span className="sched-location-tag">{sanitizeNumber(item.quantity)}</span>
                </div>
              )) : (
                <div className="schedule-item">
                  <div className="schedule-info">
                    <h5 className="sched-title">No recent transactions</h5>
                    <p className="sched-subtitle">Transactions will appear here once stock activity is recorded.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Teacher / Staff Announcements */}
          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Alerts</h4>
              <button type="button" className="view-all-link">View all</button>
            </div>

            <div className="announcement-item">
              <div className="announcement-avatar">
                <div className="avatar-img-circle">{lowStockCount > 0 ? '!' : '✓'}</div>
              </div>
              <div className="announcement-body">
                <div className="announcement-meta">
                  <span className="ann-name">Inventory status</span>
                  <span className="ann-time">Live</span>
                </div>
                <p className="ann-text">{lowStockCount > 0 ? `${lowStockCount} materials are at or below minimum stock.` : 'All stock levels are currently above minimum threshold.'}</p>
              </div>
            </div>
          </div>

          {/* Card: Upcoming Tasks */}
          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Top inventory items</h4>
              <button type="button" className="view-all-link">View all</button>
            </div>

            {topInventoryByValue.length > 0 ? topInventoryByValue.map((item, idx) => (
              <div key={`${item.name}-${idx}`} className="task-item-row">
                <div className="task-left">
                  <BookOpen size={16} className="task-icon" />
                  <div className="task-titles">
                    <span className="task-name">{item.name}</span>
                    <span className="task-detail">Value: {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(item.value)}</span>
                  </div>
                </div>
                <div className="task-dates">
                  <span>{idx + 1}</span>
                  <span className="date-badge-highlight">Rank</span>
                </div>
              </div>
            )) : (
              <div className="task-item-row">
                <div className="task-left">
                  <BookOpen size={16} className="task-icon" />
                  <div className="task-titles">
                    <span className="task-name">No material data</span>
                    <span className="task-detail">Add materials to populate this list.</span>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* ── MIDDLE COLUMN (CHARTS) ── */}
        <div className="dash-column center-column">

          {/* Chart 1: Inventory Stock vs. Revenue */}
          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Inventory Stock vs. Value</h4>
              <button type="button" className="dropdown-select-btn">
                Per Item <ChevronDown size={14} />
              </button>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={inventoryChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="stock" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorStock)" dot={{ r: 3, fill: '#06b6d4' }} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" dot={{ r: 3, fill: '#10b981' }} />
                <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>

            <div className="chart-legend-bottom">
              <div className="legend-chip"><span className="dot cyan-dot" /> Inventory units</div>
              <div className="legend-chip"><span className="dot green-dot" /> Inventory value</div>
            </div>
          </div>

          {/* Chart 2: Monthly Stock Movement */}
          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Monthly Stock Movement</h4>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last 6 months</span>
            </div>

            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#627f90' }} />
                <YAxis tick={{ fontSize: 11, fill: '#627f90' }} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="in"  name="Stock In"  fill="#10b981" radius={[4,4,0,0]} barSize={14} />
                <Bar dataKey="out" name="Stock Out" fill="#ef4444" radius={[4,4,0,0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>

            <div className="chart-legend-bottom">
              <div className="legend-chip"><span className="dot" style={{ background: '#10b981' }} /> Stock In</div>
              <div className="legend-chip"><span className="dot" style={{ background: '#ef4444' }} /> Stock Out</div>
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN (SIDEBAR PANELS) ── */}
        <div className="dash-column right-column">

          {/* Quick Actions */}
          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Quick Actions</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={onQuickStockIn}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.06)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1d7f5b' }}
              >
                <ArrowDownLeft size={16} color="#10b981" /> Receive Stock (Stock In)
              </button>
              <button
                type="button"
                onClick={onQuickStockOut}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,65,58,0.2)', background: 'rgba(255,65,58,0.06)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#a20e00' }}
              >
                <ArrowUpRight size={16} color="#ff413a" /> Issue Materials (Stock Out)
              </button>
              <button
                type="button"
                onClick={onOpenRequests}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#4338ca' }}
              >
                <ClipboardList size={16} color="#6366f1" /> New Material Request
              </button>
              <button
                type="button"
                onClick={onOpenTransfers}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(14,165,233,0.2)', background: 'rgba(14,165,233,0.06)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#075985' }}
              >
                <MoveRight size={16} color="#0ea5e9" /> Transfer Stock
              </button>
            </div>
          </div>

          {/* Card: Most Issued Materials */}
          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Most Issued Materials</h4>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All time</span>
            </div>
            {mostIssuedMaterials.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>No issue transactions recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {mostIssuedMaterials.map((item, idx) => {
                  const maxQty = mostIssuedMaterials[0]?.qty || 1;
                  const pct = Math.round((item.qty / maxQty) * 100);
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#1d4b5f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{item.name}</span>
                        <span style={{ fontSize: '11px', color: '#4e6979', flexShrink: 0 }}>{item.qty} issued</span>
                      </div>
                      <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(121,160,173,0.17)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 'inherit', background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card: Stock health */}
          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Stock health</h4>
              <button type="button" className="view-all-link">Live</button>
            </div>

            <div className="target-plan-container">
              <div className="target-progress-header">
                <span className="target-pct">{stockHealthPercent}%</span>
                <span className="target-label">Healthy stock coverage</span>
              </div>

              <div className="target-progress-bar-bg">
                <div className="target-progress-fill" style={{ width: `${Math.max(0, Math.min(100, stockHealthPercent))}%` }} />
              </div>

              <div className="target-milestones">
                <div className="milestone-item">
                  <span className="ms-title">Items in stock</span>
                  <span className="ms-val">{totalMaterialsCount}</span>
                </div>
                <div className="milestone-item">
                  <span className="ms-title">Low stock alerts</span>
                  <span className="ms-val">{lowStockCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dash-card">
            <div className="card-header-flex">
              <h4 className="card-title">Low Stock Items</h4>
              <span className="low-stock-count">{lowStockCount}</span>
            </div>
            {lowStockItems.length === 0 ? (
              <div className="low-stock-empty">All materials are sufficiently stocked.</div>
            ) : (
              <div className="low-stock-list">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div className="low-stock-item" key={item.id || item.name}>
                    <div>
                      <div className="low-stock-name">{sanitizeText(item.name, 'Unknown')}</div>
                      <div className="low-stock-meta">Minimum: {sanitizeNumber(item.min_stock_level)} {item.unit_of_measure || 'units'}</div>
                    </div>
                    <span className="low-stock-count">{sanitizeNumber(item.current_stock)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
