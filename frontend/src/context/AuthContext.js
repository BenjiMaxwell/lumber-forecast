import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.data);
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      console.log('AuthContext: Making login request to /auth/login');
      const res = await api.post('/auth/login', { email, password });
      console.log('AuthContext: Login response received', res.data);
      
      if (res.data && res.data.token) {
        localStorage.setItem('token', res.data.token);
        setUser(res.data.user);
        return res.data;
      } else {
        console.error('AuthContext: Invalid response structure', res.data);
        throw new Error('Invalid response from server - missing token');
      }
    } catch (error) {
      console.error('AuthContext: Login error', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Re-throw with more context if needed
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        throw new Error('Cannot connect to backend server. Please verify VITE_API_URL is set correctly in Vercel environment variables.');
      }
      
      // Re-throw CORS errors
      if (error.message?.includes('CORS')) {
        throw new Error('CORS error: Backend server is not allowing requests from this domain. Check backend CORS settings.');
      }
      
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
