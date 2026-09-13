import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/services/api';
import { clearSession } from '@/services/http';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const reset = () => { setUser(null); setToken(null); };
    window.addEventListener('auth:changed', reset);
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) { setLoading(false); }
    else {
      api.request('/auth/verify').then(response => {
        if (active && storedToken === localStorage.getItem('auth_token')) {
          setToken(storedToken);
          setUser(response.data.user);
          localStorage.setItem('auth_user', JSON.stringify(response.data.user));
        }
      }).catch(() => {
        if (active && storedToken === localStorage.getItem('auth_token')) clearSession();
      }).finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; window.removeEventListener('auth:changed', reset); };
  }, []);

  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const remaining = payload.exp * 1000 - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) { clearSession(); return; }
      const timer = setTimeout(clearSession, Math.min(remaining, 2147483647));
      return () => clearTimeout(timer);
    } catch { clearSession(); }
  }, [token]);

  const login = (userData, authToken) => {
    window.dispatchEvent(new Event('auth:changed'));
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setToken(null);
  };

  const register = async (email, password, confirmPassword) => {
    const response = await api.register(email, password, confirmPassword);
    if (response.success) {
      login(response.data.user, response.data.token);
    }
    return response;
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!user && !!token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

