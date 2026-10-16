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
