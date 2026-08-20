import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { ShoppingCart, Plus, Edit2, Check, X } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export default function ProcurementManager() {
  const { currentUser } = useContext(AuthContext) || {};
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  
  // PO Form state
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([]);

  const canEdit = ['Administrator', 'Store Manager'].includes(currentUser?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [oRes, sRes, mRes] = await Promise.all([
        apiFetch('/purchase-orders'),
        apiFetch('/suppliers'),
        apiFetch('/materials')
      ]);
      if (oRes.ok) setOrders(await oRes.json());
      if (sRes.ok) setSuppliers(await sRes.json());
      if (mRes.ok) setMaterials(await mRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const addItemRow = () => {
    setItems([...items, { material_id: '', quantity_ordered: 1, unit_cost: 0 }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'material_id') {
      const mat = materials.find(m => m.id == value);
      if (mat) newItems[index].unit_cost = mat.unit_cost;
    }
    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId || items.length === 0) return showToast('Supplier and at least one item required', 'error');
    if (items.some(i => !i.material_id || i.quantity_ordered <= 0)) return showToast('All items must have a material and quantity', 'error');
    
    try {
      const res = await apiFetch('/purchase-orders', { 
        method: 'POST', 
        body: JSON.stringify({ supplier_id: supplierId, expected_date: expectedDate || null, remarks, items }) 
      });
      if (!res.ok) throw new Error('Failed to create Purchase Order');
      
      showToast('Purchase Order created');
      setShowModal(false);
      setSupplierId('');
      setExpectedDate('');
      setRemarks('');
      setItems([]);
      fetchData();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await apiFetch(`/purchase-orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error('Failed to update status');
      showToast(`PO status updated to ${status}`);
      fetchData();
    } catch(err) { showToast(err.message, 'error'); }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: '600' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-strong)' }}>Procurement (Purchase Orders)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Create and manage purchase orders to suppliers</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Create PO</button>
        )}
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-card-header)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>PO Number</th>
              <th style={{ padding: '12px 16px' }}>Supplier</th>
              <th style={{ padding: '12px 16px' }}>Total Amount</th>
              <th style={{ padding: '12px 16px' }}>Expected Date</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              {canEdit && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No purchase orders found.</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px', fontWeight: '600' }}>{o.po_number}</td>
                <td style={{ padding: '12px 16px' }}>{o.supplier_name}</td>
                <td style={{ padding: '12px 16px' }}>${parseFloat(o.total_amount).toFixed(2)}</td>
                <td style={{ padding: '12px 16px' }}>{o.expected_date ? new Date(o.expected_date).toLocaleDateString() : '-'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: o.status === 'Completed' ? '#dcfce7' : o.status === 'Cancelled' ? '#fee2e2' : '#e0e7ff', color: o.status === 'Completed' ? '#166534' : o.status === 'Cancelled' ? '#991b1b' : '#3730a3' }}>
                    {o.status}
                  </span>
                </td>
                {canEdit && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {o.status === 'Draft' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(o.id, 'Issued')}>Issue</button>
                    )}
                    {(o.status === 'Issued' || o.status === 'Partially Received') && (
                      <button className="btn btn-primary btn-sm" onClick={() => updateStatus(o.id, 'Completed')}>Complete</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90vw' }}>
            <div className="modal-header">
              <h3>Create Purchase Order</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Supplier *</label>
                    <select className="form-input" required value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Expected Date</label>
                    <input type="date" className="form-input" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="form-label">Remarks</label>
                  <input type="text" className="form-input" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
                
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>PO Items *</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}><Plus size={14} /> Add Item</button>
                </div>
                
                {items.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No items added yet.</p>}
                
                {items.map((item, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                    <select className="form-input" required value={item.material_id} onChange={e => updateItem(index, 'material_id', e.target.value)}>
                      <option value="">-- Select Material --</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.material_code})</option>)}
                    </select>
                    <input type="number" min="1" className="form-input" placeholder="Qty" required value={item.quantity_ordered} onChange={e => updateItem(index, 'quantity_ordered', e.target.value)} />
                    <input type="number" step="0.01" min="0" className="form-input" placeholder="Unit Cost" required value={item.unit_cost} onChange={e => updateItem(index, 'unit_cost', e.target.value)} />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(index)}><X size={14} /></button>
                  </div>
                ))}
                
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create PO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
