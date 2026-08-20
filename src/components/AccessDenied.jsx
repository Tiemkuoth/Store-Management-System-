import React from 'react';
import { ShieldAlert, Lock } from 'lucide-react';

/**
 * Access Denied Component
 * Displays when user doesn't have permission to access a feature
 * 
 * @param {Object} props
 * @param {string} props.feature - The feature name that is restricted
 * @param {string} props.requiredRole - The role(s) required to access this feature
 * @param {string} props.currentRole - The user's current role
 * @param {string} props.message - Custom message (optional)
 */
export default function AccessDenied({ 
  feature = 'this feature', 
  requiredRole = 'Administrator or Store Manager', 
  currentRole = 'Your current role',
  message = null 
}) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '400px',
      padding: '40px',
      textAlign: 'center'
    }}>
      <div className="glass-card" style={{ 
        padding: '40px', 
        maxWidth: '500px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid rgba(239, 68, 68, 0.3)'
        }}>
          <ShieldAlert size={40} color="#ef4444" />
        </div>

        <div>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: '800', 
            color: '#ef4444',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Lock size={20} />
            Access Denied
          </h3>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--text-muted)',
            lineHeight: '1.6'
          }}>
            {message || `You do not have permission to access ${feature}.`}
          </p>
        </div>

        <div style={{
          background: 'var(--bg-input)',
          padding: '16px 20px',
          borderRadius: '8px',
          width: '100%',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--text-muted)',
            marginBottom: '8px',
            fontWeight: '600',
            textTransform: 'uppercase'
          }}>
            Access Requirements
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: 'var(--text-main)',
            marginBottom: '8px'
          }}>
            <strong>Required Role:</strong> {requiredRole}
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: 'var(--color-warning)'
          }}>
            <strong>Your Role:</strong> {currentRole}
          </div>
        </div>

        <p style={{ 
          fontSize: '13px', 
          color: 'var(--text-dim)',
          marginTop: '8px'
        }}>
          Please contact your system administrator if you believe you should have access to this feature.
        </p>
      </div>
    </div>
  );
}

/**
 * Inline Access Denied Message (compact version for sections within a page)
 */
export function AccessDeniedInline({ feature, requiredRole, currentRole }) {
  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px'
    }}>
      <Lock size={18} color="#ef4444" style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444', marginBottom: '4px' }}>
          Access Restricted
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {feature} requires <strong>{requiredRole}</strong> role. Your role: <strong>{currentRole}</strong>
        </div>
      </div>
    </div>
  );
}
