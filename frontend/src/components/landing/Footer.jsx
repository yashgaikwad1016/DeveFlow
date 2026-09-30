import { Link } from 'react-router-dom';
import DevFlowLogo from '../brand/DevFlowLogo';

export default function Footer() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="footer-top">
          {/* Brand Col */}
          <div className="footer-brand-col">
            <Link to="/" className="landing-brand" aria-label="DevFlow - From Ideas to Delivery, All in One Flow">
              <DevFlowLogo variant="footer" priority={false} />
            </Link>
            <p>
              An integrated Agile Workspace platform designed to accelerate software engineering teams from sprint
              planning to delivery.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="footer-col">
            <h4>Overview</h4>
            <ul className="footer-links">
              <li>
                <a className="footer-link" onClick={() => scrollTo('features')}>
                  Features
                </a>
              </li>
              <li>
                <a className="footer-link" onClick={() => scrollTo('problems')}>
                  Challenges
                </a>
              </li>
              <li>
                <a className="footer-link" onClick={() => scrollTo('workflow')}>
                  How It Works
                </a>
              </li>
              <li>
                <a className="footer-link" onClick={() => scrollTo('faq')}>
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Platform Links */}
          <div className="footer-col">
            <h4>Workspace</h4>
            <ul className="footer-links">
              <li>
                <Link to="/dashboard" className="footer-link">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/projects" className="footer-link">
                  Projects
                </Link>
              </li>
              <li>
                <Link to="/sprints" className="footer-link">
                  Sprints
                </Link>
              </li>
              <li>
                <Link to="/issues" className="footer-link">
                  Issue Tracker
                </Link>
              </li>
            </ul>
          </div>

          {/* Access Links */}
          <div className="footer-col">
            <h4>Authentication</h4>
            <ul className="footer-links">
              <li>
                <Link to="/login" className="footer-link">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="footer-link">
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div>© {new Date().getFullYear()} DevFlow Technologies. All rights reserved.</div>
          <div className="footer-status-indicator">
            <span className="status-dot-green"></span>
            <span>Enterprise Workspace Engine • Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
