import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants.js';

// ==========================================
// ACCESS TOKEN MEMORY
// ==========================================

let accessToken = null;

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
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    } else {
      // Never let a caller-supplied/stale bearer survive after logout or expiry.
      delete config.headers.Authorization;
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
    // Web Locks serializes tabs where supported. The localStorage lease is a
    // best-effort cross-tab fallback for browsers without Web Locks.
    const refreshWithStorageLock = async () => {
      const lockKey = 'student-management-auth-refresh-lock';
      const owner = (
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      const leaseMs = 30_000;
      const deadline = Date.now() + 35_000;
      const sleep = (ms) => new Promise(resolve => window.setTimeout(resolve, ms));

      const readLock = () => {
        const raw = window.localStorage.getItem(lockKey);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };

      try {
        while (Date.now() < deadline) {
          const current = readLock();

          if (!current || !current.expiresAt || current.expiresAt <= Date.now()) {
            window.localStorage.setItem(
              lockKey,
              JSON.stringify({ owner, expiresAt: Date.now() + leaseMs }),
            );

            // Allow competing tabs to write, then verify that this tab owns
            // the final lease before using the shared HttpOnly cookie.
            await sleep(60 + Math.floor(Math.random() * 80));
            if (readLock()?.owner === owner) {
              try {
                return await performRefresh();
              } finally {
                if (readLock()?.owner === owner) {
                  window.localStorage.removeItem(lockKey);
                }
              }
            }
          }

          await sleep(80 + Math.floor(Math.random() * 70));
        }

        throw new Error('Không thể khóa refresh giữa các tab trong thời gian cho phép');
      } catch (error) {
        // If storage is unavailable (e.g. browser privacy restrictions), keep
        // authentication usable; server-side single-use rotation remains the
        // final authority.
        if (error?.name === 'SecurityError' || error?.name === 'QuotaExceededError') {
          return performRefresh();
        }
        throw error;
      }
    };

    const refreshAcrossTabs = () => {
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        return navigator.locks.request('student-management-auth-refresh', async () => {
          return performRefresh();
        });
      }

      if (typeof window !== 'undefined') {
        return refreshWithStorageLock();
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
      setAccessToken(null);
      window.dispatchEvent(new CustomEvent("auth:session-invalid"));
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
        window.dispatchEvent(new CustomEvent("auth:session-invalid"));
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
