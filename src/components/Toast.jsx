import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Toast Notification Component
 * Displays temporary notification messages for user actions
 * 
 * @param {Object} props
 * @param {string} props.message - The message to display
 * @param {string} props.type - Type of toast: 'success', 'error', 'warning', 'info'
 * @param {number} props.duration - Duration in ms before auto-dismiss (default: 4000)
 * @param {function} props.onClose - Callback when toast is closed
 */
export default function Toast({ message, type = 'info', duration = 4000, onClose }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'rgba(16, 185, 129, 0.95)',
      borderColor: '#10b981',
      iconColor: '#fff'
    },
    error: {
      icon: XCircle,
      bgColor: 'rgba(239, 68, 68, 0.95)',
      borderColor: '#ef4444',
      iconColor: '#fff'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'rgba(245, 158, 11, 0.95)',
      borderColor: '#f59e0b',
      iconColor: '#fff'
    },
    info: {
      icon: Info,
      bgColor: 'rgba(6, 182, 212, 0.95)',
      borderColor: '#06b6d4',
      iconColor: '#fff'
    }
  };

  const { icon: Icon, bgColor, borderColor, iconColor } = config[type] || config.info;

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: bgColor,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '14px 18px',
        minWidth: '320px',
        maxWidth: '480px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
        color: '#fff',
        animation: 'toastSlideIn 0.3s ease-out'
      }}
    >
      <Icon size={20} color={iconColor} style={{ flexShrink: 0 }} />
      
      <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', lineHeight: '1.4' }}>
        {message}
      </div>

      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.8,
          transition: 'opacity 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '1'}
        onMouseLeave={(e) => e.target.style.opacity = '0.8'}
      >
        <X size={18} />
      </button>

      <style>
        {`
          @keyframes toastSlideIn {
            from {
              opacity: 0;
              transform: translateX(100px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
    </div>
  );
}

/**
 * Toast Container Component
 * Manages multiple toast notifications
 * 
 * @param {Object} props
 * @param {Array} props.toasts - Array of toast objects
 * @param {function} props.removeToast - Function to remove a toast by id
 */
export function ToastContainer({ toasts, removeToast }) {
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  );
}
