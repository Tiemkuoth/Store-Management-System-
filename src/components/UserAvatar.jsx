import React, { useRef, useState } from 'react';
import { API_BASE } from '../utils/apiFetch';

/**
 * UserAvatar — shows a profile photo or a coloured-initials fallback.
 *
 * Props:
 *   user   — object with { full_name, avatar_url, role }
 *   size   — pixel size (square, default 32)
 *   style  — extra inline styles
 */

const ROLE_COLORS = {
  Administrator:   { from: '#ef4444', to: '#b91c1c' },
  'Store Manager': { from: '#f59e0b', to: '#d97706' },
  Storekeeper:     { from: '#10b981', to: '#059669' },
  Auditor:         { from: '#06b6d4', to: '#0891b2' },
  Viewer:          { from: '#8b5cf6', to: '#7c3aed' },
};

const PALETTE = [
  { from: '#4f46e5', to: '#7c3aed' },
  { from: '#0ea5e9', to: '#0284c7' },
  { from: '#22c55e', to: '#16a34a' },
  { from: '#f59e0b', to: '#d97706' },
  { from: '#ec4899', to: '#db2777' },
];

export function getInitials(fullName = '') {
  if (typeof fullName !== 'string') return 'U';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) {
    const n = parts[0];
    return (n[0] + (n[1] || '')).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashString(s = '') {
  return Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
}

export function getAvatarGradient(key = '', role = '') {
  if (role && ROLE_COLORS[role]) {
    const { from, to } = ROLE_COLORS[role];
    return `linear-gradient(135deg, ${from}, ${to})`;
  }
  const hash = Math.abs(hashString(key || 'default'));
  const i = hash % PALETTE.length;
  const { from, to } = PALETTE[i];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export default function UserAvatar({ user, size = 32, style = {} }) {
  const [imgError, setImgError] = useState(false);

  const src = user?.avatar_url;
  let resolvedSrc = src;
  // Prefix /avatars/ paths with the backend base URL so images load
  // regardless of whether the Vite proxy is running
  if (src && typeof src === 'string' && src.startsWith('/avatars/')) {
    const base = (typeof API_BASE === 'string' ? API_BASE : 'http://localhost:5000/api').replace(/\/api\/?$/i, '');
    resolvedSrc = `${base}${src}`;
  }

  // Reset error flag whenever the avatar URL changes (e.g. after a new upload)
  const prevSrc = useRef(null);
  if (prevSrc.current !== src) {
    prevSrc.current = src;
    if (imgError) setImgError(false);
  }

  const showImage = resolvedSrc && !imgError;

  const radius = Math.max(6, Math.round(size * 0.16));
  const borderRadius = `${radius}px`;

  const baseStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius,
    flexShrink: 0,
    display: 'block',
    ...style,
  };

  if (showImage) {
    return (
      <img
        src={resolvedSrc}
        alt={user?.full_name || 'User'}
        onError={() => setImgError(true)}
        style={{
          ...baseStyle,
          objectFit: 'cover',
          objectPosition: 'center',
          border: '1px solid rgba(0,0,0,0.08)',
          background: 'rgba(0,0,0,0.04)',
        }}
      />
    );
  }

  // Initials fallback
  const name = user?.full_name || user?.username || '';
  const initials = getInitials(name);
  const gradient = getAvatarGradient(name, user?.role);
  const fontSize = Math.max(10, Math.round(size * 0.36));

  return (
    <div
      aria-label={name || 'User'}
      style={{
        ...baseStyle,
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize,
        letterSpacing: '0.02em',
        userSelect: 'none',
        border: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      {initials}
    </div>
  );
}
