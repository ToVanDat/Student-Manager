import axios from "axios";

import { API_BASE_URL } from '@/utils/constants.js';
//login
export const loginApi = async (username, password) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/login`,
    {
      username,
      password,
    },
    {
      withCredentials: true,
    },
  );

  return response.data;
};

//register

export const registerApi = async (username, email, password) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
    username,
    email,
    password,
  });

  return response.data;
};

//refresh
export const refreshApi = async () => {
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/refresh`,
    {},
    { withCredentials: true },
  );

  return response.data;
};

//logout

export const logoutApi = async () => {
  const accessToken = localStorage.getItem("accessToken");

  const response = await axios.post(
    `${API_BASE_URL}/api/auth/logout`,
    {},
    {
      withCredentials: true,

      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.data;
};

// =====================================================
// FORGOT PASSWORD
// =====================================================

export const forgotPasswordApi = async (email) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/forgot-password`,
    {
      email,
    },
  );

  return response.data;
};

// =====================================================
// VERIFY OTP
// =====================================================

export const verifyResetOtpApi = async (email, otp) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/verify-reset-otp`,
    {
      email,
      otp,
    },
  );

  return response.data;
};

// =====================================================
// RESET PASSWORD
// =====================================================

export const resetPasswordApi = async (resetToken, newPassword) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
    resetToken,
    newPassword,
  });

  return response.data;
};

export const googleLoginApi = async (idToken) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/google/login`, { idToken }, { withCredentials: true });
  return response.data;
};

export const beginPasskeyLoginApi = async (username) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/passkeys/login/options`, { username }, { withCredentials: true });
  return response.data;
};

export const finishPasskeyLoginApi = async (challengeId, responsePayload) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/passkeys/login/verify`, { challengeId, response: responsePayload }, { withCredentials: true });
  return response.data;
};

const authenticatedAuthConfig = () => ({
  withCredentials: true,
  headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` }
});

export const beginPasskeyRegistrationApi = async () => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/passkeys/registration/options`, {}, authenticatedAuthConfig());
  return response.data;
};
export const finishPasskeyRegistrationApi = async (challengeId, responsePayload, deviceName) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/passkeys/registration/verify`, { challengeId, response: responsePayload, deviceName }, authenticatedAuthConfig());
  return response.data;
};
export const listPasskeysApi = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/auth/passkeys`, authenticatedAuthConfig());
  return response.data.credentials || [];
};
export const deletePasskeyApi = async id => {
  const response = await axios.delete(`${API_BASE_URL}/api/auth/passkeys/${encodeURIComponent(id)}`, authenticatedAuthConfig());
  return response.data;
};
export const linkGoogleApi = async (idToken, currentPassword, verificationToken) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/google/link`, { idToken, currentPassword, verificationToken }, authenticatedAuthConfig());
  return response.data;
};
export const getGoogleLinkApi = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/auth/google/link`, authenticatedAuthConfig());
  return response.data.account || null;
};
export const unlinkGoogleApi = async (currentPassword, verificationToken) => {
  const response = await axios.delete(`${API_BASE_URL}/api/auth/google/link`, {
    ...authenticatedAuthConfig(),
    data: { currentPassword, verificationToken }
  });
  return response.data;
};

export const createQrLoginApi = async () => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/qr-login`, {}, { withCredentials: true });
  return response.data;
};
export const pollQrLoginApi = async (requestId, secret) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/qr-login/poll`, { requestId, secret }, { withCredentials: true });
  return response.data;
};
export const approveQrLoginApi = async (requestId, secret) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/qr-login/approve`, { requestId, secret }, authenticatedAuthConfig());
  return response.data;
};
export const denyQrLoginApi = async (requestId, secret) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/qr-login/deny`, { requestId, secret, status: 'denied' }, { withCredentials: true });
  return response.data;
};

export const cancelQrLoginApi = async (requestId, secret) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/qr-login/deny`, {
    requestId, secret, status: 'cancelled'
  }, { withCredentials: true });
  return response.data;
};

export const beginSensitiveReauthApi = async () => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/passkeys/reauth/options`, {}, authenticatedAuthConfig());
  return response.data;
};
export const finishSensitiveReauthApi = async (challengeId, responsePayload) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/passkeys/reauth/verify`, { challengeId, response: responsePayload }, authenticatedAuthConfig());
  return response.data;
};
