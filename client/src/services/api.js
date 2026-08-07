import axios from 'axios';
import { clearAuth, setTokens } from '../store/slices/authSlice';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// A default timeout matters more than it looks: without one, axios waits
// forever, so ANY request that never cleanly settles (a dropped connection,
// a proxy that silently stops responding) leaves its promise pending — and
// with it, whatever `isLoading` state the caller set before awaiting. That
// is the mechanism behind buttons stuck on "Training…"/"Generating…"
// indefinitely, since a pending promise runs neither .catch nor .finally.
// 60s comfortably covers every normal request; the few genuinely
// long-running batch endpoints override this per-call with their own
// larger budgets.
const DEFAULT_TIMEOUT_MS = 60000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const injectStoreInApi = (store) => {
  api.interceptors.request.use(
    (config) => {
      const accessToken = store.getState().auth.accessToken || localStorage.getItem('accessToken');
      if (accessToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url.includes('/auth/login') &&
        !originalRequest.url.includes('/auth/refresh')
      ) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken =
          store.getState().auth.refreshToken || localStorage.getItem('refreshToken');

        if (!refreshToken) {
          store.dispatch(clearAuth());
          isRefreshing = false;
          return Promise.reject(error);
        }

        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const newAccessToken = data.data.accessToken;
          const newRefreshToken = data.data.refreshToken;

          store.dispatch(
            setTokens({
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
            }),
          );

          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          store.dispatch(clearAuth());
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );
};

export default api;
