import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import {
  Plus, Search, CheckCircle2, XCircle, Clock, Filter,
  ClipboardList, AlertCircle, Package, ChevronDown
} from 'lucide-react';
import apiFetch from '../utils/apiFetch';
import { sanitizeText, sanitizeNumber } from '../utils/displayValue';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';

const STATUS_BADGE = {
  Pending:  'badge-warning',
  Approved: 'badge-success',
  Rejected: 'badge-danger',
  Fulfilled:'badge-info',
};

const PRIORITY_BADGE = {
  Low:    'badge-secondary',
  Normal: 'badge-info',
  High:   'badge-warning',
  Urgent: 'badge-danger',
};

export default function MaterialRequests() {
  const { materials = [], employees = [], fetchData: onRefresh } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};
  const toast = useToast();

  const [requests, setRequests]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('LIST');
  const [searchTerm, setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const canApprove = ['Administrator', 'Store Manager'].includes(currentUser?.role);
  const canRequest = ['Administrator', 'Store Manager', 'Storekeeper', 'Viewer', 'Auditor'].includes(currentUser?.role);

  const [form, setForm] = useState({
    material_id: '',
    quantity: 1,
    purpose: '',
    priority: 'Normal',
    remarks: '',
  });

  // ── Fetch requests ──────────────────────────────────────────
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/material-requests?limit=200');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : (data?.data || []));
    } catch (e) {
      toast.error('Failed to load material requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  // ── Submit new request ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.material_id) return toast.error('Please select a material');
    if (!form.purpose.trim()) return toast.error('Purpose is required');
    setSubmitting(true);
    try {
      const res = await apiFetch('/material-requests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error || 'Failed to submit request'); return; }
      toast.success(`Request ${data.request_code} submitted successfully`);
      setForm({ material_id: '', quantity: 1, purpose: '', priority: 'Normal', remarks: '' });
      setActiveTab('LIST');
      fetchRequests();
    } catch (err) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Approve ─────────────────────────────────────────────────
  const handleApprove = async (req) => {
    try {
      const res = await apiFetch(`/material-requests/${req.id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ remarks: 'Approved' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error || 'Approval failed'); return; }
      toast.success(`Request ${req.request_code} approved`);
      fetchRequests();
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Approval failed');
    }
  };

  // ── Reject ──────────────────────────────────────────────────
  const openReject = (req) => { setSelectedReq(req); setRejectionRemark(''); setShowRejectModal(true); };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectionRemark.trim()) return toast.error('Rejection reason is required');
    try {
      const res = await apiFetch(`/material-requests/${selectedReq.id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ remarks: rejectionRemark }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error || 'Rejection failed'); return; }
      toast.success(`Request ${selectedReq.request_code} rejected`);
      setShowRejectModal(false);
      fetchRequests();
    } catch (err) {
      toast.error(err.message || 'Rejection failed');
    }
  };

  // ── Filter ──────────────────────────────────────────────────
  const filtered = requests.filter(r => {
    const matchSearch =
      (r.request_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.material_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.requester_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.purpose || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Tabs bar */}
      <div className="glass-card" style={{ padding: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'LIST' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('LIST')}
        >
          <ClipboardList size={16} />
          All Requests
          {pendingCount > 0 && (
            <span style={{ marginLeft: '4px', background: '#f59e0b', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px', fontWeight: '700' }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          className={`btn ${activeTab === 'NEW' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('NEW')}
        >
          <Plus size={16} /> New Request
        </button>
      </div>

      {/* ── LIST TAB ── */}
      {activeTab === 'LIST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Filter bar */}
          <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input" style={{ paddingLeft: '34px' }}
                placeholder="Search by code, material, requester, purpose…"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={15} color="var(--text-muted)" />
              <select
                className="form-select" style={{ minWidth: '160px' }}
                value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Fulfilled">Fulfilled</option>
              </select>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filtered.length} requests</span>
          </div>

          {/* Requests table */}
          <div className="table-container glass-card">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading requests…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {searchTerm || statusFilter !== 'ALL' ? 'No requests match your filters.' : 'No material requests yet.'}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Request Code</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Priority</th>
                    <th>Purpose</th>
                    <th>Requested By</th>
                    <th>Status</th>
                    <th>Approved By</th>
                    <th>Date</th>
                    {canApprove && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(req => (
                    <tr key={req.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: '#818cf8' }}>
                          {req.request_code}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-muted-strong)' }}>{sanitizeText(req.material_name, '—')}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.material_code}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                        {sanitizeNumber(req.quantity)} {req.unit_of_measure || ''}
                      </td>
                      <td>
                        <span className={`badge ${PRIORITY_BADGE[req.priority] || 'badge-secondary'}`}>
                          {req.priority || 'Normal'}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sanitizeText(req.purpose, '—')}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {sanitizeText(req.requester_name, req.requester_username || '—')}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[req.status] || 'badge-secondary'}`}>
                          {req.status === 'Pending' && <Clock size={11} style={{ marginRight: '3px' }} />}
                          {req.status === 'Approved' && <CheckCircle2 size={11} style={{ marginRight: '3px' }} />}
                          {req.status === 'Rejected' && <XCircle size={11} style={{ marginRight: '3px' }} />}
                          {req.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {req.approver_name || (req.status === 'Pending' ? <em style={{ opacity: 0.6 }}>Awaiting</em> : '—')}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}
                      </td>
                      {canApprove && (
                        <td>
                          {req.status === 'Pending' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleApprove(req)}
                                title="Approve this request"
                              >
                                <CheckCircle2 size={13} /> Approve
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => openReject(req)}
                                title="Reject this request"
                              >
                                <XCircle size={13} /> Reject
                              </button>
                            </div>
                          )}
                          {req.status !== 'Pending' && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── NEW REQUEST TAB ── */}
      {activeTab === 'NEW' && (
        <div className="glass-card" style={{ padding: '24px', maxWidth: '700px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Package size={18} color="var(--primary)" />
              <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-muted-strong)' }}>
                New Material Request
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Submit a request for materials. A Store Manager or Administrator will review and approve it.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Material *</label>
                <select
                  className="form-select"
                  value={form.material_id}
                  onChange={e => setForm(f => ({ ...f, material_id: e.target.value }))}
                  required
                >
                  <option value="">Select a material…</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.material_code} — {m.name} (Available: {m.current_stock} {m.unit_of_measure})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quantity Requested *</label>
                <input
                  type="number" className="form-input" min="1"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Purpose / Justification *</label>
                <input
                  type="text" className="form-input"
                  placeholder="e.g. Office supplies for Q3 operations, IT equipment for new hires…"
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Additional Remarks</label>
                <textarea
                  className="form-textarea" rows="3"
                  placeholder="Any additional notes or specifications…"
                  value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button
                type="button" className="btn btn-secondary"
                onClick={() => setActiveTab('LIST')}
              >
                Cancel
              </button>
              <button
                type="submit" className="btn btn-primary"
                disabled={submitting}
              >
                <ClipboardList size={15} />
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {showRejectModal && selectedReq && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--danger)' }}>
                Reject Request — {selectedReq.request_code}
              </h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }}
                onClick={() => setShowRejectModal(false)}
              >×</button>
            </div>
            <form onSubmit={handleReject}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,65,58,0.06)', border: '1px solid rgba(255,65,58,0.18)', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Rejecting request for <strong style={{ color: 'var(--text-muted-strong)' }}>{selectedReq.material_name}</strong> × {selectedReq.quantity}
                </div>
                <div className="form-group">
                  <label className="form-label">Rejection Reason *</label>
                  <textarea
                    className="form-textarea" rows="3"
                    placeholder="Explain why this request is being rejected…"
                    value={rejectionRemark}
                    onChange={e => setRejectionRemark(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger">
                  <XCircle size={14} /> Reject Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  );
}
