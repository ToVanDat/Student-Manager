import { apiClient } from '@/api/client.js';

// ======================================================
// GET SESSIONS
// ======================================================

export const getSessionsApi = async () => {
  const response = await apiClient.get('/api/auth/sessions');
  return response.data;
};

// ======================================================
// REVOKE 1 SESSION
// ======================================================

export const revokeSessionApi = async (sessionId) => {
  const response = await apiClient.delete(`/api/auth/sessions/${encodeURIComponent(sessionId)}`);
  return response.data;
};

// ======================================================
// REVOKE OTHER SESSIONS
// ======================================================

export const revokeOtherSessionsApi = async () => {
  const response = await apiClient.post('/api/auth/sessions/revoke-others', {});
  return response.data;
};
