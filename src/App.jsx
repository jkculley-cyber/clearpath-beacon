import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AppShell from './components/layout/AppShell';

/* ── Page imports (placeholders until pages agent fills them) ── */
import DashboardPage from './pages/DashboardPage';
import SchedulePage from './pages/SchedulePage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import ReferralsPage from './pages/ReferralsPage';
import TimeTrackerPage from './pages/TimeTrackerPage';
import LessonsPage from './pages/LessonsPage';
import CommunicationsPage from './pages/CommunicationsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import ReferralFormPage from './pages/ReferralFormPage';

/* ── Auth guard ── */
function RequireAuth({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/referral-form" element={<ReferralFormPage />} />

      {/* Authenticated routes inside AppShell */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="groups/:id" element={<GroupDetailPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="referrals" element={<ReferralsPage />} />
        <Route path="time-tracker" element={<TimeTrackerPage />} />
        <Route path="lessons" element={<LessonsPage />} />
        <Route path="communications" element={<CommunicationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
