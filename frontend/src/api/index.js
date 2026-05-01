import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────
export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  me: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
  changePassword: (data) => API.put('/auth/change-password', data),
};

// ── Dashboard ─────────────────────────────────────────────
export const dashboardAPI = {
  get: () => API.get('/dashboard'),
};

// ── Projects ──────────────────────────────────────────────
export const projectsAPI = {
  list: () => API.get('/projects'),
  get: (id) => API.get(`/projects/${id}`),
  create: (data) => API.post('/projects', data),
  update: (id, data) => API.put(`/projects/${id}`, data),
  delete: (id) => API.delete(`/projects/${id}`),
  addMember: (id, data) => API.post(`/projects/${id}/members`, data),
  removeMember: (projectId, userId) => API.delete(`/projects/${projectId}/members/${userId}`),
};

// ── Tasks ─────────────────────────────────────────────────
export const tasksAPI = {
  list: (params) => API.get('/tasks', { params }),
  get: (id) => API.get(`/tasks/${id}`),
  create: (data) => API.post('/tasks', data),
  update: (id, data) => API.put(`/tasks/${id}`, data),
  updateStatus: (id, status) => API.patch(`/tasks/${id}/status`, { status }),
  delete: (id) => API.delete(`/tasks/${id}`),
  addComment: (id, content) => API.post(`/tasks/${id}/comments`, { content }),
};

// ── Users ─────────────────────────────────────────────────
export const usersAPI = {
  list: () => API.get('/users'),
  get: (id) => API.get(`/users/${id}`),
  updateRole: (id, role) => API.patch(`/users/${id}/role`, { role }),
  delete: (id) => API.delete(`/users/${id}`),
  getNotifications: () => API.get('/users/notifications/me'),
  markRead: (id) => API.patch(`/users/notifications/${id}/read`),
  markAllRead: () => API.patch('/users/notifications/read-all/mark'),
};

export default API;
