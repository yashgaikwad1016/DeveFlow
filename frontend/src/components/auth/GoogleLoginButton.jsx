import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function GoogleLoginButton({
  onSuccess,
  onError,
  loading = false,
  text = 'Continue with Google',
}) {
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const tokenClientRef = useRef(null);

  // 1. Fetch Google Client ID from backend if not present in env
  useEffect(() => {
    if (!clientId) {
      api.get('/auth/google-client-id')
        .then((res) => {
          if (res.data?.clientId) {
            setClientId(res.data.clientId);
          }
        })
        .catch(() => {});
    }
  }, [clientId]);

  // 2. Load Google Identity Services Script
  useEffect(() => {
    if (window.google?.accounts?.oauth2) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setSdkLoaded(true);
    };
    script.onerror = () => {
      console.warn('Google Identity Services SDK could not be loaded.');
    };
    document.head.appendChild(script);
  }, []);

  // 3. Initialize Google OAuth2 Token Client (Select Account Popup)
  useEffect(() => {
    if (!sdkLoaded || !clientId || !window.google?.accounts?.oauth2) return;

    try {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        callback: (tokenResponse) => {
          setInternalLoading(false);
          if (tokenResponse?.error) {
            console.error('Google OAuth error:', tokenResponse);
            if (onError) onError(tokenResponse);
            return;
          }
          if (tokenResponse?.access_token) {
            if (onSuccess) {
              onSuccess({ accessToken: tokenResponse.access_token });
            }
          }
        },
        error_callback: (err) => {
          setInternalLoading(false);
          console.error('Google OAuth popup error:', err);
          if (onError) onError(err);
        },
      });
    } catch (err) {
      console.error('Google token client initialization failed:', err);
    }
  }, [sdkLoaded, clientId, onSuccess, onError]);

  // 4. Click Handler: Always triggers clean Google Account Selector
  const handleClick = () => {
    if (!clientId) {
      toast.error('Google Client ID is not configured yet.');
      return;
    }

    if (!tokenClientRef.current && window.google?.accounts?.oauth2) {
      try {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: (tokenResponse) => {
            setInternalLoading(false);
            if (tokenResponse?.access_token && onSuccess) {
              onSuccess({ accessToken: tokenResponse.access_token });
            }
          },
        });
      } catch (e) {}
    }

    if (tokenClientRef.current) {
      setInternalLoading(true);
      // prompt: 'select_account' forces Google to show the account picker
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
    } else {
      toast.error('Google Sign-In is initializing. Please try again in a moment.');
    }
  };

  const isLoading = loading || internalLoading;
  const buttonLabel =
    text === 'signin_with' ? 'Continue with Google' :
    text === 'signup_with' ? 'Sign up with Google' :
    text || 'Continue with Google';

  return (
    <div className="google-auth-wrapper">
      <button
        type="button"
        className="google-signin-custom-btn"
        onClick={handleClick}
        disabled={isLoading}
        title={buttonLabel}
        aria-label={buttonLabel}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" className="google-icon" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{isLoading ? 'Connecting to Google…' : buttonLabel}</span>
      </button>
    </div>
  );
}
