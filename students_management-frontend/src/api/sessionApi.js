import axios from "axios";

import { API_BASE_URL } from '../constant';


const getAuthConfig = () => {
  const accessToken = localStorage.getItem("accessToken");

  return {
    withCredentials: true,

    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
};

// ======================================================
// GET SESSIONS
// ======================================================

export const getSessionsApi = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/auth/sessions`,
    getAuthConfig(),
  );

  return response.data;
};

// ======================================================
// REVOKE 1 SESSION
// ======================================================

export const revokeSessionApi = async (sessionId) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/auth/sessions/${sessionId}`,
    getAuthConfig(),
  );

  return response.data;
};

// ======================================================
// REVOKE OTHER SESSIONS
// ======================================================

export const revokeOtherSessionsApi = async () => {
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/sessions/revoke-others`,
    {},
    getAuthConfig(),
  );

  return response.data;
};
