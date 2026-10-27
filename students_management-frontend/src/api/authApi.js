import axios from "axios";

import { API_BASE_URL } from '@/utils/constants.js';
import apiClient, { getAccessToken } from '@/api/client.js';
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
  const accessToken = getAccessToken();

  const response = await axios.post(
    `${API_BASE_URL}/api/auth/logout`,
    {},
    {
      withCredentials: true,

      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`,
      } : {},
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
 
export const beginBiometricLoginApi = async username => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/biometric-login/options`, { username }, { withCredentials: true });
  return response.data;
};
export const finishBiometricLoginApi = async (challengeId, responsePayload) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/biometric-login/verify`, { challengeId, response: responsePayload }, { withCredentials: true });
  return response.data;
};
export const getBiometricLoginStatusApi = async () => {
  const response = await apiClient.get('/api/auth/biometric-login/status');
  return response.data;
};

// Authenticated endpoints use the shared client so expired ATs follow the
// application's common refresh-and-retry flow.
export const beginPasskeyRegistrationApi = async () => (await apiClient.post('/api/auth/passkeys/registration/options', {})).data;
export const finishPasskeyRegistrationApi = async (challengeId, responsePayload, deviceName) => (await apiClient.post('/api/auth/passkeys/registration/verify', { challengeId, response: responsePayload, deviceName })).data;
export const listPasskeysApi = async () => {
  const response = await apiClient.get('/api/auth/passkeys');
  return response.data.credentials || [];
};
export const deletePasskeyApi = async id => (await apiClient.delete(`/api/auth/passkeys/${encodeURIComponent(id)}`)).data;
export const linkGoogleApi = async (idToken, currentPassword, verificationToken) => (await apiClient.post('/api/auth/google/link', { idToken, currentPassword, verificationToken })).data;
export const getGoogleLinkApi = async () => {
  const response = await apiClient.get('/api/auth/google/link');
  return response.data.account || null;
};
export const unlinkGoogleApi = async (currentPassword, verificationToken) => (await apiClient.delete('/api/auth/google/link', { data: { currentPassword, verificationToken } })).data;

export const createQrLoginApi = async () => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/qr-login`, {}, { withCredentials: true });
  return response.data;
};
export const pollQrLoginApi = async (requestId, secret) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/qr-login/poll`, { requestId, secret }, { withCredentials: true });
  return response.data;
};
export const approveQrLoginApi = async (requestId, secret) => {
  const response = await apiClient.post('/api/auth/qr-login/approve', { requestId, secret });
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

export const beginSensitiveReauthApi = async purpose => {
  const response = await apiClient.post('/api/auth/passkeys/reauth/options', { purpose });
  return response.data;
};
export const finishSensitiveReauthApi = async (challengeId, responsePayload, purpose) => {
  const response = await apiClient.post('/api/auth/passkeys/reauth/verify', { challengeId, response: responsePayload, purpose });
  return response.data;
};


export const getFaceLoginStatusApi = async () => (await apiClient.get('/api/auth/face/status')).data;
export const beginFaceEnrollmentApi = async (verificationToken, currentPassword) => (await apiClient.post('/api/auth/face/enrollment/options', { verificationToken, currentPassword })).data;
export const finishFaceEnrollmentApi = async challengeId => (await apiClient.post('/api/auth/face/enrollment/verify', { challengeId })).data;
export const captureFaceEnrollmentFrameApi = async (challengeId, livenessNonce, frame) => {
  const body = new FormData();
  body.append('challengeId', challengeId);
  body.append('livenessNonce', livenessNonce);
  body.append('frame', frame, 'face-frame.jpg');
  return (await apiClient.post('/api/auth/face/enrollment/frame', body, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const disableFaceLoginApi = async () => (await apiClient.delete('/api/auth/face/credential')).data;
export const beginFaceLoginApi = async username => (await axios.post(`${API_BASE_URL}/api/auth/face/login/options`, { username }, { withCredentials: true })).data;
export const captureFaceLoginFrameApi = async (challengeId, livenessNonce, frame) => {
  const body = new FormData();
  body.append('challengeId', challengeId);
  body.append('livenessNonce', livenessNonce);
  body.append('frame', frame, 'face-frame.jpg');
  return (await axios.post(`${API_BASE_URL}/api/auth/face/login/frame`, body, { withCredentials: true })).data;
};
export const finishFaceLoginApi = async challengeId => (await axios.post(`${API_BASE_URL}/api/auth/face/login/verify`, { challengeId }, { withCredentials: true })).data;
