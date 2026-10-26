import apiClient from './client.js';

export const getUserPreferences = async () => {
  const response = await apiClient.get('/api/auth/preferences');
  return response.data?.preferences;
};

export const updateUserPreferences = async (preferences) => {
  const response = await apiClient.patch('/api/auth/preferences', preferences);
  return response.data?.preferences;
};
