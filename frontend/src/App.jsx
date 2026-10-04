import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth, isTokenExpired } from './context/AuthContext';
import { ToastProvider, ModalProvider } from './components/Overlays';

// Layout & Landing Page (Immediate)
import AppLayout from './layouts/AppLayout';
import LandingPage from './pages/LandingPage';

// Lazy-loaded Auth Pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'));
const GitHubCallback = lazy(() => import('./pages/GitHubCallback'));

// Lazy-loaded App Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const SprintsPage = lazy(() => import('./pages/SprintsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const IssuesPage = lazy(() => import('./pages/IssuesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AiInsightsPage = lazy(() => import('./pages/AiInsightsPage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const AdminPaymentsPage = lazy(() => import('./pages/AdminPaymentsPage'));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage'));

// Lightweight Suspense Loader
function SuspenseFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'blobFloat 0.8s linear infinite' }}></div>
    </div>
  );
}

// Protected Route Component (Ensures valid authentication on every render/history navigation)
function ProtectedLayout() {
  const { token, org, logout } = useAuth();
  const location = useLocation();

  const isExpired = isTokenExpired(token);

  useEffect(() => {
    if (token && isExpired) {
      logout();
    }
  }, [token, isExpired, logout]);

  if (!token || isExpired) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <AppLayout org={org} />;
}

// Public-only Route (Redirects already-authenticated users directly to Dashboard)
function PublicRoute({ children }) {
  const { token } = useAuth();

  if (token && !isTokenExpired(token)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Role-restricted Route Component
function RoleRoute({ role, children }) {
  const { isAdmin, isMgr } = useAuth();

  if (role === 'admin' && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }
  if (role === 'mgr' && !isMgr()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ModalProvider>
            <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
            <Suspense fallback={<SuspenseFallback />}>
              <Routes>
                {/* Public Landing & Auth Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <Register />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/verify-otp"
                  element={
                    <PublicRoute>
                      <VerifyOTP />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/auth/github/callback"
                  element={<GitHubCallback />}
                />
                <Route
                  path="/auth"
                  element={
                    <PublicRoute>
                      <Navigate to="/login" replace />
                    </PublicRoute>
                  }
                />
                <Route path="/invite/:token" element={<AcceptInvitePage />} />

                {/* Protected App Routes */}
                <Route element={<ProtectedLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/sprints" element={<SprintsPage />} />
                  <Route
                    path="/tasks"
                    element={
                      <RoleRoute role="admin">
                        <TasksPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/task/:id"
                    element={
                      <RoleRoute role="admin">
                        <TasksPage />
                      </RoleRoute>
                    }
                  />
                  <Route path="/issues" element={<IssuesPage />} />
                  <Route
                    path="/reports"
                    element={
                      <RoleRoute role="mgr">
                        <ReportsPage />
                      </RoleRoute>
                    }
                  />
                  <Route path="/ai" element={<AiInsightsPage />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route
                    path="/users"
                    element={
                      <RoleRoute role="admin">
                        <UsersPage />
                      </RoleRoute>
                    }
                  />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/billing" element={<BillingPage />} />
                  <Route
                    path="/admin/payments"
                    element={
                      <RoleRoute role="admin">
                        <AdminPaymentsPage />
                      </RoleRoute>
                    }
                  />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </ModalProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
