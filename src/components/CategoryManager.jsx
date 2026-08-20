import React, { useState, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { Tag, Plus, Edit2, Trash2, Check, X } from 'lucide-react';

// const API_BASE = 'http://localhost:5000/api'; // removed, using relative paths

const API_BASE = 'http://localhost:5000/api';

// Authenticated fetch — attaches Bearer token to every request
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function CategoryManager() {
  const { categories = [], fetchData: onRefresh } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};
  const [newName, setNewName]       = useState('');
  const [editingId, setEditingId]   = useState(null);
  const [editName, setEditName]     = useState('');
  const [delId, setDelId]           = useState(null);
  const [toast, setToast]           = useState(null);

  const canEdit = ['Administrator', 'Store Manager'].includes(currentUser?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() })
      });
      if (!res.ok) {
        const d = await parseJsonSafe(res);
        throw new Error(d?.error || 'Failed to add category');
      }
      setNewName('');
      onRefresh?.();
      showToast('Category added');
    } catch (err) { showToast(err.message || 'Failed to add category', 'error'); }
  };

  const startEdit = (cat) => { setEditingId(cat.id); setEditName(cat.name); };
  const cancelEdit = ()  => { setEditingId(null); setEditName(''); };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    try {
      const res = await apiFetch(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName.trim() })
      });
      if (!res.ok) {
        const d = await parseJsonSafe(res);
        throw new Error(d?.error || 'Failed to rename');
      }
      setEditingId(null);
      onRefresh?.();
      showToast('Category renamed');
    } catch (err) { showToast(err.message || 'Failed to rename', 'error'); }
  };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/categories/${delId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await parseJsonSafe(res);
        throw new Error(d?.error || 'Failed to delete');
      }
      setDelId(null);
      onRefresh?.();
      showToast('Category deleted');
    } catch (err) { showToast(err.message || 'Failed to delete', 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'error' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Manage the categories used to organise materials in the registry</p>

      {/* Add form */}
      {canEdit && (
        <form onSubmit={handleAdd} className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Tag size={18} color="#6366f1" style={{ flexShrink: 0 }} />
          <input
            type="text" className="form-input" placeholder="New category name…"
            value={newName} onChange={e => setNewName(e.target.value)}
            style={{ flex: 1 }} required
          />
          <button type="submit" className="btn btn-primary">
            <Plus size={15} /> Add Category
          </button>
        </form>
      )}

      {/* Category list */}
      <div className="glass-card" style={{ padding: '8px' }}>
        {categories.length === 0 && (
          <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No categories yet.</p>
        )}
        {categories.map((cat, i) => (
          <div key={cat.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px', borderRadius: '8px',
            borderBottom: i < categories.length - 1 ? '1px solid var(--border-color)' : 'none',
          }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Tag size={15} color="#6366f1" />
            </div>

            {editingId === cat.id ? (
              <>
                <input
                  type="text" className="form-input" value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ flex: 1 }} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') cancelEdit(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={() => handleRename(cat.id)}><Check size={13} /></button>
                <button className="btn btn-secondary btn-sm" onClick={cancelEdit}><X size={13} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontWeight: '600', color: 'var(--text-muted-strong)' }}>{cat.name}</span>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(cat)}><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDelId(cat.id)}><Trash2 size={13} /></button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {delId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#ef4444' }}>Delete Category</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setDelId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Delete <strong style={{ color: 'var(--text-muted-strong)' }}>{categories.find(c => c.id === delId)?.name}</strong>? Materials in this category will become uncategorised.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
