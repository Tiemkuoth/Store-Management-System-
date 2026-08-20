import React, { useState, useContext, useEffect } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { MoveRight, Plus, Search, X } from 'lucide-react';
import { sanitizeText } from '../utils/displayValue';
import apiFetch from '../utils/apiFetch';

export default function StockTransfers({ readOnly = false }) {
  const { transfers = [], materials = [], handleTransfer: onTransfer, fetchData: _onRefresh } = useContext(DataContext) || {};
  const { currentUser: _currentUser } = useContext(AuthContext) || {};
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [form, setForm] = useState({
    material_id: '',
    quantity: '',
    source_location: '',
    destination_location: '',
    remarks: ''
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  // Also fetch when modal opens
  const handleOpenForm = () => {
    setShowForm(true);
    setError('');
    if (warehouses.length === 0) {
      fetchWarehouses();
    }
  };

  const fetchWarehouses = async () => {
    try {
      setWarehousesLoading(true);
      const res = await apiFetch('/warehouses');
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched warehouses:', data);
        setWarehouses(data || []);
      } else {
        console.error('Failed to fetch warehouses, status:', res.status);
        const err = await res.json().catch(() => ({}));
        console.error('Error details:', err);
      }
    } catch (e) {
      console.error('Failed to fetch warehouses:', e);
    } finally {
      setWarehousesLoading(false);
    }
  };

  const filtered = transfers.filter(t =>
    (t.material_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.material_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.transfer_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.source_location || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.destination_location || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedMaterial = materials.find(m => m.id == form.material_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.material_id) return setError('Please select a material');
    if (!form.quantity || parseInt(form.quantity) <= 0) return setError('Quantity must be greater than 0');
    if (!form.source_location) return setError('Source location is required');
    if (!form.destination_location) return setError('Destination location is required');
    if (form.source_location === form.destination_location) return setError('Source and destination must be different');

    setSubmitting(true);
    const err = await onTransfer({
      material_id: form.material_id,
      quantity: parseInt(form.quantity),
      source_location: form.source_location,
      destination_location: form.destination_location,
      remarks: form.remarks
    });
    setSubmitting(false);

    if (err) { setError(err); }
    else {
      setForm({ material_id: '', quantity: '', source_location: '', destination_location: '', remarks: '' });
      setShowForm(false);
    }
  };

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: '1 1 320px', minWidth: '240px', maxWidth: '480px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ width: '100%', paddingLeft: '38px', paddingRight: search ? '34px' : '14px' }}
            placeholder="Search transfers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {!readOnly && (
          <button className="btn btn-primary" onClick={handleOpenForm}>
            <Plus size={16} /> New Transfer
          </button>
        )}
      </div>

      {readOnly && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '13px', color: '#f59e0b' }}>
          You are in read-only mode. Contact an Administrator or Store Manager to create transfers.
        </div>
      )}

      {/* Create Transfer Modal */}
      {showForm && !readOnly && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', padding: '26px', width: 'min(100%,560px)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div>
                <h3 style={{ color: 'var(--text-muted-strong)', fontWeight: '700', fontSize: '18px', margin: 0 }}>New Stock Transfer</h3>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Move inventory between locations with a single action.</p>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px' }} aria-label="Close form"><X size={18} /></button>
            </div>

            {error && (
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Material *</label>
                  <select className="form-select" value={form.material_id} onChange={e => {
                    const mat = materials.find(m => m.id == e.target.value);
                    setForm(f => ({ ...f, material_id: e.target.value, source_location: mat?.location || '' }));
                  }}>
                    <option value="">Select material…</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.material_code}) — Stock: {m.current_stock} {m.unit_of_measure}</option>
                    ))}
                  </select>
                  {selectedMaterial && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Current location: <strong style={{ color: 'var(--text-primary)' }}>{selectedMaterial.location}</strong> · Available: <strong style={{ color: '#10b981' }}>{selectedMaterial.current_stock}</strong>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min="1" max={selectedMaterial?.current_stock || 9999} placeholder="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">From Warehouse & Store *</label>
                  <select className="form-select" value={form.source_location} onChange={e => setForm(f => ({ ...f, source_location: e.target.value }))} disabled={warehousesLoading}>
                    <option value="">{warehousesLoading ? 'Loading locations...' : 'Select…'}</option>
                    {warehouses.length > 0 ? (
                      warehouses.map(w => <option key={w.id} value={w.name}>{w.code} - {w.name}</option>)
                    ) : (
                      !warehousesLoading && <option disabled>No warehouses & stores available</option>
                    )}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MoveRight size={20} color="#6366f1" />
                </div>
                <div className="form-group">
                  <label className="form-label">To Warehouse & Store *</label>
                  <select className="form-select" value={form.destination_location} onChange={e => setForm(f => ({ ...f, destination_location: e.target.value }))} disabled={warehousesLoading}>
                    <option value="">{warehousesLoading ? 'Loading locations...' : 'Select…'}</option>
                    {warehouses.length > 0 ? (
                      warehouses.map(w => <option key={w.id} value={w.name}>{w.code} - {w.name}</option>)
                    ) : (
                      !warehousesLoading && <option disabled>No warehouses & stores available</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks</label>
                <textarea className="form-textarea" rows={4} placeholder="Optional notes…" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={{ resize: 'vertical', minHeight: '92px' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <MoveRight size={15} style={{ marginRight: '6px' }} /> {submitting ? 'Transferring…' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfers table */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 14px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MoveRight size={16} color="#6366f1" />
            <span style={{ fontWeight: '700', color: 'var(--text-muted-strong)', fontSize: '14px' }}>Transfer History</span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Review past stock moves and verify destinations quickly.</span>
          <span style={{ justifySelf: 'end', padding: '6px 12px', borderRadius: '999px', background: 'rgba(99,102,241,0.12)', color: '#c7d2fe', fontSize: '12px' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            No transfers found.{!readOnly && <> Click <strong style={{ color: '#6366f1' }}>New Transfer</strong> to move stock between locations.</>}
          </div>
        ) : (
          <div className="table-container" style={{ padding: '0 18px 18px' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px', fontSize: '13px', minWidth: '840px' }}>
              <thead>
                <tr>
                  {['Transfer Code', 'Material', 'Qty', 'From', 'To', 'By', 'Date', 'Remarks'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '14px 14px', color: '#6366f1', fontWeight: '600', whiteSpace: 'nowrap' }}>{t.transfer_code}</td>
                    <td style={{ padding: '14px 14px', color: 'var(--text-primary)' }}>
                      <div>{t.material_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.material_code}</div>
                    </td>
                    <td style={{ padding: '14px 14px', color: '#10b981', fontWeight: '700' }}>{t.quantity}</td>
                    <td style={{ padding: '14px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.source_location}</td>
                    <td style={{ padding: '14px 14px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{t.destination_location}</td>
                    <td style={{ padding: '14px 14px', color: 'var(--text-muted)' }}>{t.transferred_by_name}</td>
                    <td style={{ padding: '14px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.transfer_date ? new Date(t.transfer_date).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '14px 14px', color: 'var(--text-muted)', maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeText(t.remarks, 'No remarks recorded')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
