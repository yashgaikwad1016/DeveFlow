import { Link } from 'react-router-dom';
import { useAuth, isTokenExpired } from '../../context/AuthContext';
import Icon from '../Icon';

export default function FinalCTA() {
  const { token } = useAuth();
  const isAuthenticated = token && !isTokenExpired(token);

  return (
    <section className="cta-section">
      <div className="landing-container">
        <div className="cta-box">
          <h2>Bring your entire Agile workflow into one workspace.</h2>
          <p>
            Experience frictionless sprint planning, real-time Kanban execution, contextual bug tracking, and
            AI-powered delivery intelligence today.
          </p>

          <div className="cta-buttons">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="cta-btn-primary">
                  <span>Open Dashboard</span>
                  <Icon name="arrow" />
                </Link>
                <Link to="/projects" className="cta-btn-secondary">
                  <span>Browse Projects</span>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="cta-btn-primary">
                  <span>Get Started Free</span>
                  <Icon name="arrow" />
                </Link>
                <Link to="/login" className="cta-btn-secondary">
                  <span>Sign In to Workspace</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
