import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        error.message = 'Cannot connect to server. Please ensure the backend is running on port 5000.';
      }
      return Promise.reject(error);
    }
    
    // Handle HTTP errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
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
