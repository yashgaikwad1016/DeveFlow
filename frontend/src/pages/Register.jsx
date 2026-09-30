import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import DevFlowLogo from '../components/brand/DevFlowLogo';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';
import GithubLoginButton from '../components/auth/GithubLoginButton';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
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

      toast.success(`Welcome to DevFlow, ${user?.name || user?.username || 'Member'}!`);

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 350);
    } catch (error) {
      console.error('Google Sign-Up Error:', error);
      toast.error(error.response?.data?.message || 'Google Sign-Up failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.error('Google Auth Error:', err);
    toast.error('Google Sign-Up was cancelled or failed.');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      
      toast.success('Registration successful! Please check your email for OTP.');
      navigate('/verify-otp', { state: { email: formData.email } });
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Registration failed');
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
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Link to="/" className="auth-logo-badge" title="DevFlow - Return to Home">
              <DevFlowLogo variant="hero" priority={true} />
            </Link>
          </div>
          <div className="auth-brand-badge">DevFlow</div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join DevFlow Agile Workspace today</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="johndoe"
              className="input-field"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
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
                placeholder="Choose a secure password"
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

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              className="input-field"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or sign up with</span>
        </div>

        <div className="oauth-buttons-group">
          <GoogleLoginButton
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            loading={googleLoading}
            text="Sign up with Google"
          />

          <GithubLoginButton
            text="Sign up with GitHub"
          />
        </div>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
