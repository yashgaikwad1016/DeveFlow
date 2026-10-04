import api from './api';

export const authService = {
  getStatus: () => api.get('/status').then(r => r.data),
  setup: (data) => api.post('/setup', data).then(r => r.data),
  login: (data) => api.post('/login', data).then(r => r.data),
  forgot: (data) => api.post('/forgot', data).then(r => r.data),
  getMe: () => api.get('/me').then(r => r.data),
  updateMe: (data) => api.put('/me', data).then(r => r.data),
};

export const projectService = {
  list: () => api.get('/projects').then(r => r.data),
  create: (data) => api.post('/projects', data).then(r => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/projects/${id}`).then(r => r.data),
  getMembers: (id) => api.get(`/projects/${id}/members`).then(r => r.data),
  addMember: (id, data) => api.post(`/projects/${id}/members`, data).then(r => r.data),
  removeMember: (id, uid) => api.delete(`/projects/${id}/members/${uid}`).then(r => r.data),
};

export const sprintService = {
  list: (params) => api.get('/sprints', { params }).then(r => r.data),
  create: (data) => api.post('/sprints', data).then(r => r.data),
  update: (id, data) => api.put(`/sprints/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/sprints/${id}`).then(r => r.data),
  getReport: (id) => api.get(`/reports/sprint/${id}`).then(r => r.data),
};

export const taskService = {
  list: (params) => api.get('/tasks', { params }).then(r => r.data),
  get: (id) => api.get(`/tasks/${id}`).then(r => r.data),
  create: (data) => api.post('/tasks', data).then(r => r.data),
  update: (id, data) => api.put(`/tasks/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/tasks/${id}`).then(r => r.data),
  addComment: (id, data) => api.post(`/tasks/${id}/comments`, data).then(r => r.data),
  addAttachment: (id, formData) => api.post(`/tasks/${id}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data),
};

export const issueService = {
  list: (params) => api.get('/issues', { params }).then(r => r.data),
  create: (formData) => api.post('/issues', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data),
  createJson: (data) => api.post('/issues', data).then(r => r.data),
  update: (id, data) => api.put(`/issues/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/issues/${id}`).then(r => r.data),
};

export const userService = {
  list: () => api.get('/users').then(r => r.data),
  create: (data) => api.post('/users', data).then(r => r.data),
  update: (id, data) => api.put(`/users/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/users/${id}`).then(r => r.data),
};

export const notificationService = {
  list: () => api.get('/notifications').then(r => r.data),
  markAllRead: () => api.put('/notifications/read').then(r => r.data),
};

export const activityService = {
  list: (params) => api.get('/activity', { params }).then(r => r.data),
};

export const reportService = {
  getProject: (id) => api.get(`/reports/project/${id}`).then(r => r.data),
  getSprint: (id) => api.get(`/reports/sprint/${id}`).then(r => r.data),
  exportProjectCsv: (id, name = 'Project') => {
    return api.get(`/reports/project/${id}/export`, { responseType: 'blob' }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DevFlow-${name.replace(/[^a-zA-Z0-9-_]/g, '_')}-Tasks.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  },
  exportSprintCsv: (id, name = 'Sprint') => {
    return api.get(`/reports/sprint/${id}/export`, { responseType: 'blob' }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DevFlow-${name.replace(/[^a-zA-Z0-9-_]/g, '_')}-Tasks.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  },
  exportPaymentsCsv: () => {
    return api.get(`/reports/payments/export`, { responseType: 'blob' }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DevFlow-Payments-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  },
};

export const invitationService = {
  list: (projectId) => api.get(`/projects/${projectId}/invitations`).then(r => r.data),
  send: (projectId, data) => api.post(`/projects/${projectId}/invitations`, data).then(r => r.data),
  revoke: (projectId, inviteId) => api.delete(`/projects/${projectId}/invitations/${inviteId}`).then(r => r.data),
  verify: (token) => api.get(`/invitations/${token}`).then(r => r.data),
  accept: (token) => api.post('/invitations/accept', { token }).then(r => r.data),
};

export const dashboardService = {
  get: () => api.get('/dashboard').then(r => r.data),
  search: (q) => api.get('/search', { params: { q } }).then(r => r.data),
};

export const settingsService = {
  get: () => api.get('/settings').then(r => r.data),
  update: (data) => api.put('/settings', data).then(r => r.data),
};

export const healthService = {
  check: () => api.get('/health').then(r => r.data),
};

export const aiService = {
  getPriority: (params) => api.get('/ai/priority', { params }).then(r => r.data),
  getPredict: (params) => api.get('/ai/predict', { params }).then(r => r.data),
  getPerformance: (params) => api.get('/ai/performance', { params }).then(r => r.data),
  applyPriority: (id) => api.post(`/ai/apply/${id}`).then(r => r.data),
};

export const paymentService = {
  getConfig: () => api.get('/payments/config').then(r => r.data),
  getPlans: () => api.get('/payments/plans').then(r => r.data),
  createOrder: (data) => api.post('/payments/create-order', data).then(r => r.data),
  verifyPayment: (data) => api.post('/payments/verify', data).then(r => r.data),
  getHistory: () => api.get('/payments/history').then(r => r.data),
  getById: (id) => api.get(`/payments/${id}`).then(r => r.data),
  downloadReceipt: (paymentId, receiptNumber) => {
    return api.get(`/payments/${paymentId}/receipt`, { responseType: 'blob' }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DevFlow-Receipt-${receiptNumber || paymentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  },
  getAdminPayments: (params) => api.get('/admin/payments', { params }).then(r => r.data),
};

export const subscriptionService = {
  getCurrent: () => api.get('/subscriptions/current').then(r => r.data),
  cancel: () => api.post('/subscriptions/cancel').then(r => r.data),
  changePlan: (data) => api.post('/subscriptions/change-plan', data).then(r => r.data),
};
