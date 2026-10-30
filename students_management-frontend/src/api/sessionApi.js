import { apiClient } from '@/api/client.js';

// Access tokens are memory-only in AuthContext/apiClient. Do not read them
// from localStorage or create a second Axios client: that sends "Bearer null"
// and bypasses the shared refresh/interceptor lifecycle.
const SESSIONS_ENDPOINT = '/api/auth/sessions';

export const getSessionsApi = async () => {
  const response = await apiClient.get(SESSIONS_ENDPOINT);
  return response.data;
};

export const revokeSessionApi = async (sessionId) => {
  const response = await apiClient.delete(
    `${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`,
  );
  return response.data;
};

export const revokeOtherSessionsApi = async () => {
  const response = await apiClient.post(`${SESSIONS_ENDPOINT}/revoke-others`);
  return response.data;
};
