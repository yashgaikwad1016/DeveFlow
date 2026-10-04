import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, isTokenExpired } from '../../context/AuthContext';
import Icon from '../Icon';
import DevFlowLogo from '../brand/DevFlowLogo';

export default function Navbar() {
  const { token, user } = useAuth();
  const isAuthenticated = token && !isTokenExpired(token);

  const [theme, setTheme] = useState(() => localStorage.getItem('df_theme') || 'dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('df_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="landing-nav">
      <div className="landing-container">
        <div className="landing-nav-inner">
          {/* Brand */}
          <Link to="/" className="landing-brand" aria-label="DevFlow - From Ideas to Delivery, All in One Flow">
            <DevFlowLogo variant="navbar" priority={true} />
          </Link>

          {/* Desktop Nav Links */}
          <nav className="landing-nav-links">
            <a className="landing-nav-link" onClick={() => scrollToSection('features')}>
              Features
            </a>
            <a className="landing-nav-link" onClick={() => scrollToSection('problems')}>
              Challenges
            </a>
            <a className="landing-nav-link" onClick={() => scrollToSection('workflow')}>
              How It Works
            </a>
            <Link to="/billing" className="landing-nav-link">
              Pricing
            </Link>
            <a className="landing-nav-link" onClick={() => scrollToSection('faq')}>
              FAQ
            </a>
          </nav>

          {/* Nav Actions */}
          <div className="landing-nav-actions">
            {/* Theme Toggle */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>

            {isAuthenticated ? (
              <Link to="/dashboard" className="nav-btn-cta">
                <span>Dashboard</span>
                <Icon name="arrow" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="nav-btn-signin">
                  Sign In
                </Link>
                <Link to="/register" className="nav-btn-cta">
                  <span>Get Started</span>
                  <Icon name="arrow" />
                </Link>
              </>
            )}

            {/* Mobile Toggle */}
            <button
              className="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation"
            >
              <Icon name={mobileMenuOpen ? 'x' : 'menu'} />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: '16px 0 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <a className="landing-nav-link" onClick={() => scrollToSection('features')}>
              Features
            </a>
            <a className="landing-nav-link" onClick={() => scrollToSection('problems')}>
              Challenges
            </a>
            <a className="landing-nav-link" onClick={() => scrollToSection('workflow')}>
              How It Works
            </a>
            <Link to="/billing" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>
              Pricing
            </Link>
            <a className="landing-nav-link" onClick={() => scrollToSection('faq')}>
              FAQ
            </a>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              {isAuthenticated ? (
                <Link to="/dashboard" className="nav-btn-cta" style={{ width: '100%', justifyContent: 'center' }}>
                  Open Dashboard <Icon name="arrow" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="btn"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="nav-btn-cta"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
