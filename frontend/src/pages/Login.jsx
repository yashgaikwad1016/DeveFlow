import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import DevFlowLogo from '../components/brand/DevFlowLogo';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';
import GithubLoginButton from '../components/auth/GithubLoginButton';

const Login = () => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  const handleGoogleSuccess = async (authData) => {
    setGoogleLoading(true);
    try {
      const payload = typeof authData === 'string'
        ? { credential: authData }
        : authData;
      const response = await api.post('/auth/google', payload);
      const token = response.data.accessToken || response.data.token;
      const user = response.data.user;

      // Store session in sessionStorage
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

      toast.success(`Welcome, ${user?.name || user?.username || 'Member'}!`);

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 350);
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      toast.error(error.response?.data?.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.error('Google Auth Error:', err);
    toast.error('Google Sign-In was cancelled or failed.');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const emailToSubmit = formData.email.trim();

      // In Admin Mode, only the fixed Admin (DevFlow5173@admin.com) is permitted
      if (isAdminMode && emailToSubmit.toLowerCase() !== 'devflow5173@admin.com'.toLowerCase()) {
        toast.error('Access Denied: Only the system Administrator (DevFlow5173@admin.com) can sign in here.');
        setLoading(false);
        return;
      }

      const response = await api.post('/auth/login', {
        email: emailToSubmit,
        password: formData.password
      });
      
      const token = response.data.accessToken || response.data.token;
      const user = response.data.user;

      // If logging in via Admin Portal, verify user actually has the Admin role
      if (isAdminMode && user?.role !== 'Admin') {
        toast.error('Access Denied: This account does not have Administrator privileges. Please use Member Login.');
        setLoading(false);
        return;
      }

      // Store session in sessionStorage (expires when browser/tab is closed)
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

      if (isAdminMode) {
        toast.success(`Welcome back, Admin ${user?.name || user?.username}!`);
        // 1) when on Admin Login, redirect to http://localhost:5173/dashboard
        setTimeout(() => {
          if (window.location.port === '5173') {
            navigate('/dashboard', { replace: true });
          } else {
            const adminDashboardUrl = `http://localhost:5173/dashboard?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}`;
            window.location.replace(adminDashboardUrl);
          }
        }, 400);
      } else {
        toast.success('Login successful!');
        // 2) when on Member Login, redirect to http://localhost:5174/dashboard
        setTimeout(() => {
          if (window.location.port === '5174') {
            navigate('/dashboard', { replace: true });
          } else {
            const memberDashboardUrl = `http://localhost:5174/dashboard?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}`;
            window.location.replace(memberDashboardUrl);
          }
        }, 400);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Animated background blobs */}
      <div className="blob-1 animate-blob"></div>
      <div className="blob-2 animate-blob animation-delay-2000"></div>
      <div className="blob-3 animate-blob animation-delay-4000"></div>

      <div className="auth-card">
        {/* Login Role Toggle Tabs */}
        <div className="auth-mode-toggle">
          <button
            type="button"
            className={`auth-mode-btn ${!isAdminMode ? 'active' : ''}`}
            onClick={() => setIsAdminMode(false)}
          >
            👤 Member Login
          </button>
          <button
            type="button"
            className={`auth-mode-btn ${isAdminMode ? 'active' : ''}`}
            onClick={() => setIsAdminMode(true)}
          >
            🛡️ Admin Login
          </button>
        </div>

        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Link to="/" className="auth-logo-badge" title="DevFlow - Return to Home">
              <DevFlowLogo variant="hero" priority={true} />
            </Link>
          </div>
          <div className="auth-brand-badge">
            {isAdminMode ? '👑 Administrator Portal' : 'DevFlow Workspace'}
          </div>
          <h1 className="auth-title">
            {isAdminMode ? 'Admin Sign In' : 'Welcome Back'}
          </h1>
          <p className="auth-subtitle">
            {isAdminMode
              ? 'Dedicated administrator portal for DevFlow workspace'
              : 'Sign in to access your DevFlow workspace'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">
              {isAdminMode ? 'Admin Email' : 'Email Address'}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={isAdminMode ? "Enter Admin Email" : "Enter your Email"}
              className="input-field"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={isAdminMode ? "Enter admin password" : "Enter your password"}
                className="input-field password-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle-btn"
                aria-label="Toggle password visibility"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading
              ? 'Verifying...'
              : (isAdminMode ? '🛡️ Sign In as Admin' : 'Sign In')}
          </button>
        </form>

        {!isAdminMode && (
          <>
            <div className="auth-divider">
              <span>or continue with</span>
            </div>

            <div className="oauth-buttons-group">
              <GoogleLoginButton
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                loading={googleLoading}
                text="Continue with Google"
              />

              <GithubLoginButton
                text="Continue with GitHub"
              />
            </div>

            <div className="auth-footer">
              <p>
                Don't have an account?{' '}
                <Link to="/register" className="auth-link">
                  Register
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
