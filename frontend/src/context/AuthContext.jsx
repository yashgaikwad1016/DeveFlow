import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api, { isTokenExpired } from '../utils/api';

export { isTokenExpired };

const AuthContext = createContext(null);

function getInitialAuthState() {
  // Clear any lingering persistent tokens from localStorage
  try {
    localStorage.removeItem('df_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('df_user');
  } catch (e) {}

  try {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlUser = params.get('user');

    if (urlToken && !isTokenExpired(urlToken)) {
      sessionStorage.setItem('df_token', urlToken);
      sessionStorage.setItem('accessToken', urlToken);
      let parsedUser = null;
      if (urlUser) {
        try {
          parsedUser = JSON.parse(urlUser);
          sessionStorage.setItem('df_user', urlUser);
        } catch (e) {
          console.error('Error parsing user from URL:', e);
        }
      }
      // Remove token & user query params from URL bar cleanly
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return { token: urlToken, user: parsedUser };
    }
  } catch (e) {
    console.error('Error initializing auth state from URL:', e);
  }

  const savedToken = sessionStorage.getItem('df_token') || sessionStorage.getItem('accessToken');
  if (!savedToken || isTokenExpired(savedToken)) {
    sessionStorage.clear();
    return { token: null, user: null };
  }

  let savedUser = null;
  try {
    savedUser = JSON.parse(sessionStorage.getItem('df_user') || 'null');
  } catch {
    savedUser = null;
  }
  return { token: savedToken, user: savedUser };
}

export function AuthProvider({ children }) {
  const initial = getInitialAuthState();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);
  const [org, setOrg] = useState('');
  const [isReady, setIsReady] = useState(false);

  const login = useCallback((tokenVal, userVal) => {
    sessionStorage.setItem('df_token', tokenVal);
    sessionStorage.setItem('accessToken', tokenVal);
    sessionStorage.setItem('df_user', JSON.stringify(userVal));
    try {
      localStorage.removeItem('df_token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('df_user');
    } catch (e) {}
    setToken(tokenVal);
    setUser(userVal);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { credentials: 'include' }).catch(() => {});
    } catch (e) {}

    try {
      if (window.google?.accounts?.id?.disableAutoSelect) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (e) {}

    sessionStorage.clear();
    try {
      localStorage.removeItem('df_token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('df_user');
    } catch (e) {}
    setToken(null);
    setUser(null);
  }, []);

  const verifySession = useCallback(async () => {
    const currentToken =
      sessionStorage.getItem('df_token') || sessionStorage.getItem('accessToken');
    if (!currentToken) {
      await logout();
      return false;
    }

    try {
      const res = await api.get('/auth/get-me');
      if (res.data?.user) {
        setUser(res.data.user);
        sessionStorage.setItem('df_user', JSON.stringify(res.data.user));
        return true;
      }
    } catch (e) {
      if (e.response?.status === 401) {
        await logout();
        return false;
      }
      // If server unreachable or restarting, don't immediately kick user out
      return true;
    }
    return true;
  }, [logout]);

  // Handle Back/Forward history navigation and bfcache restoration
  useEffect(() => {
    const checkAuth = () => {
      const currentToken = sessionStorage.getItem('df_token') || sessionStorage.getItem('accessToken');
      if (!currentToken || isTokenExpired(currentToken)) {
        if (token) {
          logout();
        }
      } else if (currentToken !== token) {
        setToken(currentToken);
        try {
          const u = JSON.parse(sessionStorage.getItem('df_user') || 'null');
          setUser(u);
        } catch {
          setUser(null);
        }
      }
    };

    const handlePageshow = () => {
      checkAuth();
    };

    const handlePopstate = () => {
      checkAuth();
    };

    window.addEventListener('pageshow', handlePageshow);
    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('pageshow', handlePageshow);
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [token, logout]);

  // Initial session validation
  useEffect(() => {
    if (token) {
      verifySession().finally(() => setIsReady(true));
    } else {
      setIsReady(true);
    }
  }, []);

  const updateUser = useCallback((partial) => {
    setUser(prev => {
      const updated = { ...prev, ...partial };
      sessionStorage.setItem('df_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isAdmin = () => user?.role === 'Admin';
  const isMgr = () => ['Admin', 'Manager'].includes(user?.role);

  return (
    <AuthContext.Provider value={{ token, user, org, setOrg, login, logout, updateUser, isAdmin, isMgr, verifySession, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
