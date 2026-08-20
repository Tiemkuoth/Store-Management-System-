import React, { useState, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { Truck, Plus, Mail, Phone, MapPin, Package, Edit2, Trash2, User } from 'lucide-react';
import apiFetch from '../utils/apiFetch';
import { sanitizeText } from '../utils/displayValue';

// const API_BASE = 'http://localhost:5000/api'; // removed, using relative paths

export default function SupplierManager() {
  const { suppliers = [], materials = [], handleAddSupplier: onAddSupplier, fetchData: onRefresh } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDelConfirm, setShowDelConfirm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [toast, setToast] = useState(null);

  const emptyForm = { name: '', contact_person: '', email: '', phone: '', address: '' };
  const [formData, setFormData] = useState(emptyForm);
  const [editData, setEditData] = useState(emptyForm);

  const canEdit = ['Administrator', 'Store Manager'].includes(currentUser?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    onAddSupplier(formData);
    setFormData(emptyForm);
    setShowAddModal(false);
    showToast('Supplier registered successfully');
  };

  const openEdit = (sup) => {
    setSelectedSupplier(sup);
    setEditData({ name: sup.name, contact_person: sup.contact_person || '', email: sup.email || '', phone: sup.phone || '', address: sup.address || '' });
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/suppliers/${selectedSupplier.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editData, user_id: currentUser.id, username: currentUser.username, user_role: currentUser.role })
        });
      setShowEditModal(false);
      onRefresh?.();
      showToast('Supplier updated successfully');
    } catch { showToast('Failed to update supplier', 'error'); }
  };

  const openDelete = (sup) => { setSelectedSupplier(sup); setShowDelConfirm(true); };

  const handleDelete = async () => {
    try {
      await apiFetch(`/suppliers/${selectedSupplier.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUser.id, username: currentUser.username, user_role: currentUser.role })
        });
      setShowDelConfirm(false);
      onRefresh?.();
      showToast(`Supplier "${selectedSupplier.name}" deleted`);
    } catch { showToast('Failed to delete supplier', 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'error' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Manage vendors, contact information, and supplied materials</p>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Supplier
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {suppliers.length === 0 && (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1/-1' }}>
            No suppliers registered yet.
          </div>
        )}
        {suppliers.map(sup => {
          const suppliedMats = materials.filter(m => m.supplier_id == sup.id);
          return (
            <div key={sup.id} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(16,185,129,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Truck size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-muted-strong)' }}>{sup.name}</h4>
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>{sup.supplier_code}</span>
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm" title="Edit" onClick={() => openEdit(sup)}><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm" title="Delete" onClick={() => openDelete(sup)}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={13} /> <span>{sanitizeText(sup.contact_person, 'Contact pending')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={13} /> <span>{sanitizeText(sup.email, 'Email pending')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={13} /> <span>{sanitizeText(sup.phone, 'Phone pending')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={13} /> <span>{sanitizeText(sup.address, 'Address pending')}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <Package size={13} />
                <span>{suppliedMats.length} materials supplied</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ADD MODAL ── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Register New Supplier</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <SupplierFields data={formData} onChange={v => setFormData(v)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {showEditModal && selectedSupplier && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Edit Supplier — {selectedSupplier.supplier_code}</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <SupplierFields data={editData} onChange={v => setEditData(v)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {showDelConfirm && selectedSupplier && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#ef4444' }}>Delete Supplier</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowDelConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Delete <strong style={{ color: 'var(--text-muted-strong)' }}>{selectedSupplier.name}</strong>? Materials linked to this supplier will lose their supplier reference.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierFields({ data, onChange }) {
  const f = (key, val) => onChange({ ...data, [key]: val });
  return (
    <>
      <div className="form-group">
        <label className="form-label">Company Name *</label>
        <input type="text" className="form-input" placeholder="e.g. TechCorp Solutions" value={data.name} onChange={e => f('name', e.target.value)} required />
      </div>
      <div className="form-group">
        <label className="form-label">Contact Person *</label>
        <input type="text" className="form-input" placeholder="e.g. Abebe Girma" value={data.contact_person} onChange={e => f('contact_person', e.target.value)} required />
      </div>
      <div className="form-group">
        <label className="form-label">Email Address</label>
        <input type="email" className="form-input" placeholder="contact@company.com" value={data.email} onChange={e => f('email', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Phone Number</label>
        <input type="text" className="form-input" placeholder="+251-911-000000" value={data.phone} onChange={e => f('phone', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Address</label>
        <textarea className="form-textarea" rows="2" placeholder="Street, City, Region" value={data.address} onChange={e => f('address', e.target.value)} />
      </div>
    </>
  );
}
