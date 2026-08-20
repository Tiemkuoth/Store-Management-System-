import React, { useContext } from 'react';
import { HelpCircle, Book, MessageSquare, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

export default function HelpSupport() {
  const { currentUser } = useContext(AuthContext) || {};
  // Use the logged-in admin's email, or a generic fallback
  const adminEmail = currentUser?.email || 'contact your administrator';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', background: 'rgba(99,102,241,0.1)', borderRadius: '10px', color: '#6366f1' }}>
              <Book size={24} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-strong)', margin: 0 }}>User Guide</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
            Learn how to use the Store Management System effectively. This guide covers basic navigation, creating purchase orders, receiving stock, and generating reports.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }}>Download PDF Guide</button>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px', color: '#10b981' }}>
              <HelpCircle size={24} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-strong)', margin: 0 }}>FAQ</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <details style={{ background: 'var(--bg-card-header)', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>
              <summary style={{ fontWeight: '500', color: 'var(--text-strong)' }}>How do I reset my password?</summary>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>Click on your profile avatar in the top right, select "Change Password", and enter your new credentials. If you are locked out, contact the Administrator.</p>
            </details>
            <details style={{ background: 'var(--bg-card-header)', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>
              <summary style={{ fontWeight: '500', color: 'var(--text-strong)' }}>How is inventory value calculated?</summary>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>The system uses the current stock quantity multiplied by the unit cost to determine the total inventory valuation.</p>
            </details>
            <details style={{ background: 'var(--bg-card-header)', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>
              <summary style={{ fontWeight: '500', color: 'var(--text-strong)' }}>Can I delete a transaction?</summary>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>No. To maintain audit integrity, transactions cannot be deleted. You must perform an adjustment or return to correct errors.</p>
            </details>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', background: 'rgba(245,158,11,0.1)', borderRadius: '10px', color: '#f59e0b' }}>
              <MessageSquare size={24} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-strong)', margin: 0 }}>Contact Admin</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
            Encountering a bug or need permission changes? Reach out to the system administrator.
          </p>
          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '8px', fontSize: '14px', color: 'var(--text-strong)' }}>
            <strong>Email:</strong> {adminEmail}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '24px', marginTop: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-strong)', margin: '0 0 16px 0' }}>System Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={18} color="#10b981" />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status</div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-strong)' }}>Online</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={18} color="#f59e0b" />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Time</div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-strong)' }}>{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
