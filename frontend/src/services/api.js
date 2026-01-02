import axios from 'axios';

// Get API URL from environment variable or use default
// In production, set VITE_API_URL to your backend URL (e.g., https://your-backend.railway.app/api)
const getApiUrl = () => {
  // Check if we have an explicit API URL set
  if (import.meta.env.VITE_API_URL) {
    const apiUrl = import.meta.env.VITE_API_URL;
    console.log('Using API URL from environment:', apiUrl);
    return apiUrl;
  }
  
  // In development, use proxy
  if (import.meta.env.DEV) {
    console.log('Development mode: Using /api proxy');
    return '/api';
  }
  
  // In production, warn if no API URL is set
  console.warn('⚠️ VITE_API_URL is not set! API calls will fail. Please set VITE_API_URL in Vercel environment variables.');
  console.warn('Current environment:', {
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD
  });
  
  // Default to relative path (won't work if backend is on different domain)
  return '/api';
};

const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      let errorMessage = 'Cannot connect to server.';
      
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to backend server. Please check your API URL configuration.';
      } else if (error.message?.includes('CORS')) {
        errorMessage = 'CORS error: Backend server is not allowing requests from this domain.';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error: Unable to reach the backend server. Please verify VITE_API_URL is set correctly in Vercel.';
      }
      
      // Log detailed error for debugging
      console.error('API Error Details:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          method: error.config?.method
        }
      });
      
      error.message = errorMessage;
      return Promise.reject(error);
    }
    
    // Handle HTTP errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // No redirect - authentication is disabled
    }
    
    // Log HTTP errors
    console.error('API HTTP Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url
    });
    
    return Promise.reject(error);
  }
);

export default api;

// API helper functions
export const inventoryApi = {
  getAll: (params) => api.get('/inventory', { params }),
  getOne: (id) => api.get(`/inventory/${id}`),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
  recordCount: (id, data) => api.post(`/inventory/${id}/count`, data),
  getHistory: (id, params) => api.get(`/inventory/${id}/history`, { params }),
  getSummary: () => api.get('/inventory/summary'),
  bulkCount: (data) => api.post('/inventory/bulk-count', data),
  importCSV: (formData) => api.post('/inventory/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export const orderApi = {
  getAll: (params) => api.get('/orders', { params }),
  getOne: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  getLeadTimes: () => api.get('/orders/lead-times'),
  getPendingSummary: () => api.get('/orders/pending-summary')
};

export const vendorApi = {
  getAll: (params) => api.get('/vendors', { params }),
  getOne: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  setPrice: (id, data) => api.post(`/vendors/${id}/prices`, data),
  compare: (data) => api.post('/vendors/compare', data),
  optimizeOrder: (data) => api.post('/vendors/optimize-order', data),
  getPriceHistory: (itemId) => api.get(`/vendors/price-history/${itemId}`)
};

export const forecastApi = {
  getOne: (itemId, params) => api.get(`/forecasts/${itemId}`, { params }),
  getBatch: (params) => api.get('/forecasts/batch', { params }),
  getReorderRecommendations: () => api.get('/forecasts/reorder-recommendations'),
  retrain: () => api.post('/forecasts/retrain'),
  getModelStatus: () => api.get('/forecasts/model-status')
};

export const alertApi = {
  getAll: (params) => api.get('/alerts', { params }),
  getSummary: () => api.get('/alerts/summary'),
  acknowledge: (id) => api.put(`/alerts/${id}/acknowledge`),
  resolve: (id, data) => api.put(`/alerts/${id}/resolve`, data),
  dismiss: (id) => api.put(`/alerts/${id}/dismiss`),
  getAnomalies: (params) => api.get('/alerts/anomalies', { params }),
  triggerCheck: (type) => api.post('/alerts/check', { type })
};
