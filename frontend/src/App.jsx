import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth, isTokenExpired } from './context/AuthContext';
import { ToastProvider, ModalProvider } from './components/Overlays';

// Layout
import AppLayout from './layouts/AppLayout';

// Auth Pages (JWT Auth System)
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOTP from './pages/VerifyOTP';

// App Pages
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import SprintsPage from './pages/SprintsPage';
import TasksPage from './pages/TasksPage';
import IssuesPage from './pages/IssuesPage';
import ReportsPage from './pages/ReportsPage';
import AiInsightsPage from './pages/AiInsightsPage';
import ActivityPage from './pages/ActivityPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';

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
            <Routes>
              {/* Public Auth Routes */}
              <Route
                path="/"
                element={
                  <PublicRoute>
                    <Navigate to="/login" replace />
                  </PublicRoute>
                }
              />
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
                path="/auth"
                element={
                  <PublicRoute>
                    <Navigate to="/login" replace />
                  </PublicRoute>
                }
              />

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
                <Route
                  path="/settings"
                  element={
                    <RoleRoute role="admin">
                      <SettingsPage />
                    </RoleRoute>
                  }
                />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ModalProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
