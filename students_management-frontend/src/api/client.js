import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants.js';

// ==========================================
// ACCESS TOKEN MEMORY
// ==========================================

let accessToken = localStorage.getItem("accessToken");

// ==========================================
// AXIOS INSTANCE
// ==========================================

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: accessToken ? `Bearer ${accessToken}` : undefined,
  },
  withCredentials: true,
});

// ==========================================
// SET ACCESS TOKEN
// ==========================================

export const setAccessToken = (token) => {
  accessToken = token;

  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
};

// ==========================================
// GET ACCESS TOKEN
// ==========================================

export const getAccessToken = () => {
  return accessToken;
};

// ==========================================
// REQUEST INTERCEPTOR
// ==========================================

apiClient.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  },
);

// ==========================================
// REFRESH STATE
// ==========================================

let refreshPromise = null;

// ==========================================
// RESPONSE INTERCEPTOR
// ==========================================

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Không refresh chính request /refresh
    if (originalRequest.url?.includes("/api/auth/refresh")) {
      localStorage.removeItem("accessToken");

      localStorage.removeItem("user");

      window.location.href = "/login";

      return Promise.reject(error);
    }

    // Không refresh logout
    if (originalRequest.url?.includes("/api/auth/logout")) {
      return Promise.reject(error);
    }

    // Chống vòng lặp vô hạn
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // ==========================================
    // CHỈ CHO 1 REFRESH CHẠY
    // ==========================================

    if (!refreshPromise) {
      refreshPromise = axios
        .post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          {
            withCredentials: true,
          },
        )
        .then((response) => {
          const newAccessToken = response.data.accessToken;

          setAccessToken(newAccessToken);

          return newAccessToken;
        })
        .catch((refreshError) => {
          setAccessToken(null);

          localStorage.removeItem("user");

          window.location.href = "/login";

          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const newAccessToken = await refreshPromise;

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
