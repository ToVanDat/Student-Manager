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

  // Đồng bộ token mới cho AuthContext/Socket ngay cả khi token
  // được refresh bởi Axios interceptor thay vì bởi AuthContext.
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("auth:access-token-changed", {
        detail: { accessToken: token || null },
      }),
    );
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
  async (config) => {
    // Keep the in-memory token in sync with the token updated by login,
    // refresh, or another app module. This also avoids sending an empty
    // Authorization header when the module was loaded before auth completed.
    if (!accessToken && typeof localStorage !== 'undefined') {
      accessToken = localStorage.getItem('accessToken');
    }

    const isE2EERelayRequest = String(config.url || '').includes('/api/e2ee/relay');
    const isAuthBootstrapRequest = /\/api\/auth\/(login|register|refresh)(?:\?|$)/.test(String(config.url || ''));

    // The relay is always protected by authMiddleware. If its first request
    // happens before AuthContext has restored the access token, refresh using
    // the existing HttpOnly refresh cookie instead of sending an anonymous
    // request that can only receive "Không có Access Token".
    if (isE2EERelayRequest && !accessToken && !isAuthBootstrapRequest) {
      try {
        accessToken = await refreshAccessToken();
      } catch (error) {
        return Promise.reject(error);
      }
    }

    if (accessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },

  (error) => Promise.reject(error),
);

// ==========================================
// REFRESH STATE
// ==========================================

let refreshPromise = null;

// ==========================================
// REFRESH ACCESS TOKEN
// ==========================================

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    const performRefresh = async () => {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newAccessToken = response.data?.accessToken;

      if (!newAccessToken) {
        throw new Error("Refresh response không có accessToken");
      }

      setAccessToken(newAccessToken);
      return newAccessToken;
    };

    // A module-level promise prevents duplicate refreshes in this tab.
    // Web Locks extends that protection across tabs sharing the same cookie,
    // avoiding two tabs rotating the same single-use refresh token at once.
    const refreshAcrossTabs = () => {
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        return navigator.locks.request('student-management-auth-refresh', async () => {
          // Another tab may have refreshed while this tab waited. The refresh
          // cookie is shared by the origin, so refresh only after acquiring lock.
          return performRefresh();
        });
      }

      return performRefresh();
    };

    refreshPromise = refreshAcrossTabs().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

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

    try {
      const newAccessToken = await refreshAccessToken();

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      // A rejected/expired refresh token requires re-authentication. Network
      // and server errors are transient and must not destroy a valid session.
      if (refreshError.response?.status === 401) {
        setAccessToken(null);
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
