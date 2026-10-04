import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { invitationService } from '../services';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Overlays';
import Icon from '../components/Icon';

export default function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, token: authToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function verify() {
      try {
        setLoading(true);
        const res = await invitationService.verify(token);
        if (res.valid) {
          setInviteData(res.invitation);
        } else {
          setError('This invitation link has expired or has already been accepted.');
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Invalid invitation link');
      } finally {
        setLoading(false);
      }
    }
    if (token) verify();
  }, [token]);

  const handleAccept = async () => {
    if (!authToken) {
      navigate('/login', { state: { returnTo: `/invite/${token}` } });
      return;
    }

    try {
      setSubmitting(true);
      const res = await invitationService.accept(token);
      toast(res.message || 'Successfully joined project!', 'ok');
      navigate('/projects');
    } catch (err) {
      toast(err.response?.data?.error || err.message || 'Failed to accept invitation', 'err');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 1) 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f8fafc',
    }}>
      <div style={{
        maxWidth: 520,
        width: '100%',
        background: '#1e293b',
        borderRadius: 16,
        padding: '40px 32px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
      }}>
        {/* Brand */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)',
          }}>
            <Icon name="zap" className="w-6 h-6" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: '#fff' }}>DevFlow</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <div style={{
              width: 36,
              height: 36,
              border: '3px solid rgba(99,102,241,0.2)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Verifying project invitation...</p>
          </div>
        ) : error ? (
          <div>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}>
              <Icon name="alert" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#f8fafc' }}>
              Invitation Unavailable
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              {error}
            </p>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-block',
                background: '#334155',
                color: '#fff',
                textDecoration: 'none',
                padding: '10px 24px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div>
            <div style={{
              display: 'inline-block',
              background: 'rgba(79, 70, 229, 0.15)',
              color: '#818cf8',
              padding: '6px 14px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
              border: '1px solid rgba(129, 140, 248, 0.3)',
            }}>
              Project Team Invitation
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px 0', color: '#fff' }}>
              You're invited to join <span style={{ color: '#818cf8' }}>{inviteData.projectName}</span>
            </h1>

            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              <strong>{inviteData.inviterName || 'A teammate'}</strong> has invited you to collaborate as a{' '}
              <strong style={{ color: '#e2e8f0' }}>{inviteData.role}</strong> on DevFlow.
            </p>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: 18,
              textAlign: 'left',
              marginBottom: 28,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Invited Email:</span>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{inviteData.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Assigned Role:</span>
                <span style={{ color: '#818cf8', fontWeight: 600 }}>{inviteData.role}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Expires:</span>
                <span style={{ color: '#94a3b8' }}>{new Date(inviteData.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>

            {authToken ? (
              <button
                onClick={handleAccept}
                disabled={submitting}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  boxShadow: '0 4px 14px 0 rgba(79, 70, 229, 0.4)',
                }}
              >
                {submitting ? 'Joining Workspace...' : 'Accept Invitation & Join'}
              </button>
            ) : (
              <div>
                <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                  Please sign in to accept this invitation:
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Link
                    to="/login"
                    state={{ returnTo: `/invite/${token}` }}
                    style={{
                      flex: 1,
                      background: '#4f46e5',
                      color: '#fff',
                      textDecoration: 'none',
                      padding: '12px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      display: 'inline-block',
                    }}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    state={{ returnTo: `/invite/${token}`, email: inviteData.email }}
                    style={{
                      flex: 1,
                      background: '#334155',
                      color: '#fff',
                      textDecoration: 'none',
                      padding: '12px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      display: 'inline-block',
                    }}
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
