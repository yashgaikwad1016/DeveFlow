import axios from 'axios';

// Check if a JWT is expired (or will expire within 10 seconds)
export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    return Date.now() >= (payload.exp * 1000 - 10000);
  } catch (e) {
    return true;
  }
}

// Create centralized axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

// Synchronized token getter that seamlessly refreshes an expired access token using httpOnly refreshToken cookie
export async function getValidToken() {
  const token =
    sessionStorage.getItem('df_token') ||
    sessionStorage.getItem('accessToken') ||
    localStorage.getItem('df_token') ||
    localStorage.getItem('accessToken');

  if (!token) return null;

  if (!isTokenExpired(token)) {
    return token;
  }

  // Token is expired or expiring in <10 seconds. Attempt refresh.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshUrl = `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh-token`;
        const res = await axios.get(refreshUrl, { withCredentials: true });
        const newToken = res.data.accessToken || res.data.token;
        if (newToken) {
          sessionStorage.setItem('df_token', newToken);
          sessionStorage.setItem('accessToken', newToken);
          return newToken;
        }
        return null;
      } catch (err) {
        // Refresh token is expired or revoked
        sessionStorage.clear();
        try {
          localStorage.removeItem('df_token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('df_user');
        } catch (e) {}
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

// Request interceptor: ensure valid Authorization header
api.interceptors.request.use(
  async (config) => {
    // Skip attaching/refreshing token for public auth endpoints
    const url = config.url || '';
    const isPublicAuth =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/verify-email') ||
      url.includes('/auth/resend-otp') ||
      url.includes('/auth/refresh-token');

    if (!isPublicAuth && !config.headers.Authorization) {
      const validToken = await getValidToken();
      if (validToken) {
        config.headers.Authorization = `Bearer ${validToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: retry on 401 once with refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const refreshUrl = `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh-token`;
              const res = await axios.get(refreshUrl, { withCredentials: true });
              const newToken = res.data.accessToken || res.data.token;
              if (newToken) {
                sessionStorage.setItem('df_token', newToken);
                sessionStorage.setItem('accessToken', newToken);
                return newToken;
              }
              return null;
            } catch (e) {
              return null;
            } finally {
              refreshPromise = null;
            }
          })();
        }

        const newToken = await refreshPromise;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        // Fall through to logout
      }

      sessionStorage.clear();
      try {
        localStorage.removeItem('df_token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('df_user');
      } catch (e) {}

      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }

    // Preserve custom backend error message on error object for catch handlers
    const apiError = error.response?.data?.error || error.response?.data?.message;
    if (apiError && typeof apiError === 'string') {
      error.message = apiError;
    }

    return Promise.reject(error);
  }
);

export default api;
