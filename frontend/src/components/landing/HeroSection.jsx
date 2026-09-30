import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, isTokenExpired } from '../../context/AuthContext';
import Icon from '../Icon';
import DevFlowLogo from '../brand/DevFlowLogo';

// Lazily import the 3D scene to keep initial page render instant
const HeroScene = lazy(() => import('./HeroScene'));

// Lightweight CSS 3D fallback displayed while WebGL module loads
function HeroSceneFallback() {
  return (
    <div className="hero-fallback-cards">
      <div className="fallback-card fallback-card-1">
        <div className="badge b-In-Progress" style={{ marginBottom: 10 }}>Active Sprint</div>
        <h3 style={{ fontSize: 18, marginBottom: 6 }}>Sprint 04 • Cloud Core</h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Target: Deploy Auth & RBAC sync</p>
        <div className="prog-row">
          <div className="progress">
            <div style={{ width: '72%' }}></div>
          </div>
          <span>72%</span>
        </div>
      </div>

      <div className="fallback-card fallback-card-2">
        <div className="badge b-High" style={{ marginBottom: 10 }}>AI Insight</div>
        <h3 style={{ fontSize: 18, marginBottom: 6 }}>94% Velocity Confidence</h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>No bottleneck risk detected across 24 tasks.</p>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const { token } = useAuth();
  const isAuthenticated = token && !isTokenExpired(token);

  return (
    <section className="hero-section">
      <div className="landing-container">
        <div className="hero-grid">
          {/* Left Column: Product Story & CTA */}
          <div className="hero-content">
            <div className="hero-brand-emblem">
              <DevFlowLogo variant="hero" priority={true} />
            </div>

            <div className="hero-workflow-badge">
              <span className="dot"></span>
              <span>Next-Gen Agile Workspace</span>
            </div>

            <h1 className="hero-title">
              Plan with clarity.
              <br />
              <span className="gradient-text">Deliver with velocity.</span>
            </h1>

            <p className="hero-desc">
              DevFlow unites your sprints, multi-status Kanban boards, issue tracking, and AI-powered delivery
              insights into one unified, enterprise-grade engineering workspace.
            </p>

            <div className="hero-actions">
              {isAuthenticated ? (
                <Link to="/dashboard" className="hero-btn-primary">
                  <span>Enter Dashboard</span>
                  <Icon name="arrow" />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="hero-btn-primary">
                    <span>Get Started Free</span>
                    <Icon name="arrow" />
                  </Link>
                  <Link to="/login" className="hero-btn-secondary">
                    <span>Sign In to Workspace</span>
                  </Link>
                </>
              )}
            </div>

            {/* Core Value Flow Banner: Plan -> Collaborate -> Execute -> Deliver */}
            <div className="hero-workflow-steps">
              <div className="workflow-pill">
                <span className="workflow-pill-dot"></span>
                <span>Plan</span>
              </div>
              <span className="workflow-arrow">→</span>
              <div className="workflow-pill">
                <span className="workflow-pill-dot" style={{ background: '#7c3aed' }}></span>
                <span>Collaborate</span>
              </div>
              <span className="workflow-arrow">→</span>
              <div className="workflow-pill">
                <span className="workflow-pill-dot" style={{ background: '#db2777' }}></span>
                <span>Execute</span>
              </div>
              <span className="workflow-arrow">→</span>
              <div className="workflow-pill">
                <span className="workflow-pill-dot" style={{ background: '#10b981' }}></span>
                <span>Deliver</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive 3D Visual with Suspense Fallback */}
          <div className="hero-3d-wrapper">
            <Suspense fallback={<HeroSceneFallback />}>
              <HeroScene />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
