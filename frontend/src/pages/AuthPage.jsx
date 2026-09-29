import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services';
import { useToast } from '../components/Overlays';
import Icon from '../components/Icon';

export default function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [view, setView] = useState('login'); // 'login' | 'setup' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name: '', org_name: '', email: '', password: '', new_password: '',
    confirm_password: '', current_password: ''
  });

  useEffect(() => {
    authService.getStatus().then(s => {
      setStatus(s);
      if (s.needs_setup) setView('setup');
    }).catch(() => setErr('Cannot reach server. Please check that the backend is running.'));
  }, []);

  const set = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const d = await authService.login({ email: form.email, password: form.password });
      login(d.token, d.user);
      if (d.user.must_change) {
        navigate('/profile');
      } else {
        navigate('/dashboard');
      }
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      await authService.setup({ org_name: form.org_name, name: form.name, email: form.email, password: form.password });
      toast('Organization created. Please sign in.');
      setView('login');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const d = await authService.forgot({ email: form.email });
      toast(d.message);
      setView('login');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  if (!status) return (
    <div className="auth">
      <div className="auth-art">
        <div className="brand big"><span className="brand-logo"></span>DevFlow</div>
        <h1>Agile Project Management</h1>
        <p>Connecting...</p>
      </div>
      <div className="auth-panel">
        {err && <div className="auth-card"><p style={{ color: 'var(--red)' }}>{err}</p></div>}
      </div>
    </div>
  );

  const appName = status.app_name || 'DevFlow';

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="brand big"><span className="brand-logo"></span>{appName}</div>
        <h1>
          <span className="grad-text">Agile</span>{' '}
          Project Management
        </h1>
        <p>Streamline your team's workflow with smart task management, sprint planning, and AI-powered insights.</p>
        <ul className="auth-points">
          <li>Sprint planning &amp; tracking</li>
          <li>Smart task priority with AI</li>
          <li>Team workload balancing</li>
          <li>Real-time bug tracking</li>
        </ul>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          {view === 'login' && (
            <>
              <h2>Welcome back</h2>
              <p className="muted small" style={{ marginBottom: 16 }}>Sign in to your {status.org_name || appName} workspace</p>
              {err && <div className="banner err"><Icon name="alert" />{err}</div>}
              <form onSubmit={handleLogin}>
                <label>Email</label>
                <input type="email" value={form.email} onChange={set('email')} required autoFocus />
                <label>Password</label>
                <input type="password" value={form.password} onChange={set('password')} required />
                <button className="btn primary block" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <a className="link" style={{ textAlign: 'center' }} onClick={() => { setErr(''); setView('forgot'); }}>
                Forgot password?
              </a>
            </>
          )}

          {view === 'setup' && (
            <>
              <h2>Create your workspace</h2>
              <p className="muted small" style={{ marginBottom: 16 }}>Set up your organization and Admin account.</p>
              {err && <div className="banner err"><Icon name="alert" />{err}</div>}
              <form onSubmit={handleSetup}>
                <label>Organization name *</label>
                <input value={form.org_name} onChange={set('org_name')} required placeholder="Acme Corp" />
                <label>Your name *</label>
                <input value={form.name} onChange={set('name')} required placeholder="Full name" />
                <label>Email *</label>
                <input type="email" value={form.email} onChange={set('email')} required />
                <label>Password *</label>
                <input type="password" value={form.password} onChange={set('password')} required
                  placeholder="Min 8 chars, letters + numbers" />
                <button className="btn primary block" disabled={loading}>
                  {loading ? 'Creating…' : 'Create workspace'}
                </button>
              </form>
            </>
          )}

          {view === 'forgot' && (
            <>
              <h2>Password reset</h2>
              <p className="muted small" style={{ marginBottom: 16 }}>Your administrator will reset your password.</p>
              {err && <div className="banner err"><Icon name="alert" />{err}</div>}
              <form onSubmit={handleForgot}>
                <label>Email address</label>
                <input type="email" value={form.email} onChange={set('email')} required autoFocus />
                <button className="btn primary block" disabled={loading}>
                  {loading ? 'Sending…' : 'Request password reset'}
                </button>
              </form>
              <a className="link" style={{ textAlign: 'center' }} onClick={() => { setErr(''); setView('login'); }}>
                Back to sign in
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
