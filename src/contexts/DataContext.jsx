import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { AuthContext, getToken, apiFetch } from './AuthContext';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const { isLoggedIn, currentUser } = useContext(AuthContext);

  const [stats, setStats] = useState({});
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [disposals, setDisposals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  
  const [dbStatus, setDbStatus] = useState('Connecting...');
  const [usingFallback, setUsingFallback] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState('');
  const [retryCountdown, setRetryCountdown] = useState(10);
  
  const retryIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const clearLiveData = () => {
    setStats({});
    setMaterials([]); setCategories([]); setSuppliers([]); setEmployees([]);
    setTransactions([]); setTransfers([]); setDisposals([]); setAuditLogs([]); setUsersList([]);
    setSystemSettings({});
  };
  const fetchSystemSettings = async () => {
    if (!getToken()) return;
    try {
      const res = await apiFetch('/system-settings');
      if (res.ok) {
        const data = await res.json();
        setSystemSettings(data);
      }
    } catch (e) {
      console.warn('Could not fetch system settings:', e.message);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
  }, [isLoggedIn]);

  useEffect(() => {
    window.addEventListener('system_settings_updated', fetchSystemSettings);
    return () => window.removeEventListener('system_settings_updated', fetchSystemSettings);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (isLoggedIn) fetchData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isLoggedIn]);

  useEffect(() => {
    if (apiError && isLoggedIn) {
      setRetryCountdown(10);
      countdownRef.current = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) return 10;
          return prev - 1;
        });
      }, 1000);
      retryIntervalRef.current = setInterval(() => {
        fetchData();
      }, 10000);
    } else {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    return () => {
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [apiError, isLoggedIn]);

  const fetchData = async () => {
    if (!getToken()) return;
    try {
      fetchSystemSettings();
      const statusRes = await apiFetch('/system/status').catch((err) => {
        setApiErrorMessage(err?.message || 'Unable to reach backend server');
        return null;
      });
      if (!statusRes || !statusRes.ok) {
        let message = 'Backend server is not reachable';
        if (statusRes) {
          try {
            const errBody = await statusRes.json();
            message = errBody?.error || errBody?.message || `${statusRes.status} ${statusRes.statusText}`.trim();
          } catch {
            message = `${statusRes.status} ${statusRes.statusText}`.trim();
          }
        }
        setApiError(true);
        setApiErrorMessage(message || 'Backend server is not reachable');
        setDbStatus('Server Offline - live data unavailable');
        clearLiveData();
        return;
      }
      const statusData = await statusRes.json();
      setUsingFallback(Boolean(statusData.usingFallback));
      setDbStatus(statusData.usingFallback ? 'Resilient Local Mode' : 'MySQL Connected');

      const endpoints = [
        apiFetch('/dashboard/stats'),
        apiFetch('/materials'),
        apiFetch('/categories'),
        apiFetch('/suppliers'),
        apiFetch('/employees'),
        apiFetch('/transactions'),
        apiFetch('/transfers'),
        apiFetch('/disposals'),
        apiFetch('/audit-logs'),
        apiFetch('/users'),
      ];

      const results = await Promise.allSettled(endpoints.map(p => p.then(r => r.json())));
      const values = results.map(result => result.status === 'fulfilled' ? result.value : null);
      const [resStats, resMats, resCats, resSups, resEmps, resTxs, resTrfs, resDisps, resLogs, resUsers] = values;

      setApiError(false);
      setApiErrorMessage('');
      if (resStats && !resStats.error) setStats(resStats);
      if (Array.isArray(resMats)) setMaterials(resMats);
      if (Array.isArray(resCats)) setCategories(resCats);
      if (Array.isArray(resSups)) setSuppliers(resSups);
      if (Array.isArray(resEmps)) setEmployees(resEmps);
      if (resTxs?.data)  setTransactions(resTxs.data);
      else if (Array.isArray(resTxs)) setTransactions(resTxs);
      if (resTrfs?.data) setTransfers(resTrfs.data);
      else if (Array.isArray(resTrfs)) setTransfers(resTrfs);
      if (resDisps?.data) setDisposals(resDisps.data);
      else if (Array.isArray(resDisps)) setDisposals(resDisps);
      if (resLogs?.data) setAuditLogs(resLogs.data);
      else if (Array.isArray(resLogs)) setAuditLogs(resLogs);
      if (Array.isArray(resUsers)) setUsersList(resUsers);
    } catch (e) {
      console.warn('API fetch error:', e.message);
      setApiError(true);
      setApiErrorMessage(e.message || 'Unknown API error');
      setDbStatus('Server Offline - live data unavailable');
      clearLiveData();
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Actions
  const handleAddMaterial = async (matData) => {
    try {
      await apiFetch('/materials', { method: 'POST', body: JSON.stringify(matData) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleEditMaterial = async (id, matData) => {
    try {
      await apiFetch(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(matData) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      await apiFetch(`/materials/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleStockIn = async (data) => {
    try {
      await apiFetch('/inventory/stock-in', { method: 'POST', body: JSON.stringify(data) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleStockOut = async (data) => {
    try {
      await apiFetch('/inventory/stock-out', { method: 'POST', body: JSON.stringify(data) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleReturn = async (data) => {
    try {
      await apiFetch('/inventory/return', { method: 'POST', body: JSON.stringify(data) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAdjust = async (data) => {
    try {
      await apiFetch('/inventory/adjust', { method: 'POST', body: JSON.stringify(data) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleTransfer = async (data) => {
    try {
      const res = await apiFetch('/transfers', { method: 'POST', body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      fetchData();
      return null;
    } catch (e) { return e.message; }
  };

  const handleAddEmployee = async (empData) => {
    try {
      await apiFetch('/employees', { method: 'POST', body: JSON.stringify(empData) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAddSupplier = async (supData) => {
    try {
      await apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(supData) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAddUser = async (userData) => {
    try {
      const res = await apiFetch('/users', { method: 'POST', body: JSON.stringify(userData) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return data?.error || data?.message || `Unable to create user (${res.status})`;
      }
      fetchData();
      return null;
    } catch (e) {
      console.error(e);
      return e.message || 'Unable to reach backend server';
    }
  };

  return (
    <DataContext.Provider value={{
      stats, materials, categories, suppliers, employees,
      transactions, transfers, disposals, auditLogs, usersList,
      systemSettings, dbStatus, usingFallback, apiError,
      apiErrorMessage, retryCountdown, fetchData, setRetryCountdown,
      handleAddMaterial, handleEditMaterial, handleDeleteMaterial,
      handleStockIn, handleStockOut, handleReturn, handleAdjust,
      handleTransfer, handleAddEmployee, handleAddSupplier, handleAddUser
    }}>
      {children}
    </DataContext.Provider>
  );
};
