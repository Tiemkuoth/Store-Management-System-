import React, { createContext, useState, useEffect } from 'react';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const AuthContext = createContext();

export const getToken = () => localStorage.getItem('auth_token');
export const setToken = (t) => localStorage.setItem('auth_token', t);
export const clearToken = () => localStorage.removeItem('auth_token');

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    const savedToken = getToken();
    if (savedToken) {
      setIsLoggedIn(true);
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setCurrentUser(parsed);
        } catch (e) {
          fetchCurrentUser();
        }
      } else {
        fetchCurrentUser();
      }
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await apiFetch('/users/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        localStorage.setItem('current_user', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Could not fetch current user profile:', e.message);
    }
  };

  const handleLogin = async (username, password, callback) => {
    username = username?.trim ? username.trim() : username;
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (res.ok && data.user && data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem('current_user', JSON.stringify(data.user));
        setIsLoggedIn(true);
        fetchCurrentUser();
        callback(null);
      } else {
        const message = data?.error || data?.message || `Login failed (${res.status})`;
        callback(message);
      }
    } catch (e) {
      callback(e.message || 'Could not reach the backend server');
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('current_user');
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  const handleAvatarChange = async (dataUrl) => {
    if (!currentUser || !dataUrl || !dataUrl.startsWith('data:image/')) return;
    try {
      const res = await apiFetch('/auth/upload-avatar', {
        method: 'POST',
        body: JSON.stringify({ avatar_data_url: dataUrl }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (res.ok && data.avatar_url) {
        const updatedUser = { ...currentUser, avatar_url: data.avatar_url, ...(data.user || {}) };
        setCurrentUser(updatedUser);
        localStorage.setItem('current_user', JSON.stringify(updatedUser));
      }
    } catch {
      // Catch-all
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoggedIn, handleLogin, handleLogout, handleAvatarChange, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Authenticated fetch — attaches Bearer token to every request
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
