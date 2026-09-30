import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import DevFlowLogo from '../components/brand/DevFlowLogo';

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [statusMessage, setStatusMessage] = useState('Authenticating with GitHub...');
  const [hasError, setHasError] = useState(false);
  const executedRef = useRef(false);

  useEffect(() => {
    // Avoid double execution in React StrictMode
    if (executedRef.current) return;
    executedRef.current = true;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setHasError(true);
      const msg = errorDescription || 'GitHub authorization was declined or failed.';
      setStatusMessage(msg);
      toast.error(msg);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
      return;
    }

    if (!code) {
      setHasError(true);
      setStatusMessage('No authorization code received from GitHub.');
      toast.error('GitHub authentication failed: No code received.');
      setTimeout(() => navigate('/login', { replace: true }), 2500);
      return;
    }

    const exchangeCode = async () => {
      try {
        setStatusMessage('Exchanging credentials and verifying your account...');
        const redirectUri = `${window.location.origin}/auth/github/callback`;
        const response = await api.post('/auth/github', { code, redirectUri });

        const token = response.data.accessToken || response.data.token;
        const user = response.data.user;

        // Store session tokens in sessionStorage
        sessionStorage.setItem('accessToken', token);
        sessionStorage.setItem('df_token', token);
        if (user) {
          sessionStorage.setItem('df_user', JSON.stringify(user));
        }
        try {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('df_token');
          localStorage.removeItem('df_user');
        } catch (e) {}

        if (auth?.login) {
          auth.login(token, user);
        }

        setStatusMessage(`Welcome, ${user?.name || user?.username || 'Member'}! Redirecting...`);
        toast.success(`Welcome, ${user?.name || user?.username || 'Member'}!`);

        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
      } catch (err) {
        console.error('GitHub auth exchange error:', err);
        setHasError(true);
        const errMsg = err.response?.data?.message || err.message || 'GitHub authentication failed';
        setStatusMessage(errMsg);
        toast.error(errMsg);
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    exchangeCode();
  }, [searchParams, navigate, auth]);

  return (
    <div className="auth-page-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="blob-1 animate-blob"></div>
      <div className="blob-2 animate-blob animation-delay-2000"></div>

      <div className="auth-card" style={{ maxWidth: '440px', textAlign: 'center', padding: '40px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <DevFlowLogo variant="hero" priority={true} />
        </div>

        <div style={{ margin: '24px 0' }}>
          {!hasError ? (
            <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <div style={{ fontSize: '40px', color: '#ef4444' }}>⚠️</div>
          )}
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>
          {hasError ? 'Authentication Failed' : 'Signing In with GitHub'}
        </h2>

        <p style={{ fontSize: '14px', color: hasError ? '#f87171' : '#94a3b8', lineHeight: 1.6, marginBottom: '20px' }}>
          {statusMessage}
        </p>

        {hasError && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/login', { replace: true })}
            style={{ width: '100%', marginTop: '12px' }}
          >
            Back to Sign In
          </button>
        )}
      </div>
    </div>
  );
}
