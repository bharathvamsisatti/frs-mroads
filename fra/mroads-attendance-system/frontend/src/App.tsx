import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import SignIn from './pages/Authentication/SignIn';
import SignUp from './pages/Authentication/SignUp';
import Enroll from './pages/enroll/index';
import PublicEnroll from './pages/enroll/public';
import Recognize from './pages/recognize/index';
import FaceExtractor from './pages/face-extractor/index';
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/index';
import AttendancePage from './pages/attendance/index';
import ReportsPage from './pages/reports/index';
import ReportDetailPage from './pages/reports/detail';
import DefaultLayout from './layout/DefaultLayout';
import EnrollmentTest from './pages/enrollment-test/index';
import { FaceEnrollmentDemo } from './components/FaceEnroll';
import Loader from './common/Loader';
import PageTitle from './components/PageTitle';
import Auth from './pages/Authentication/Auth';
import Verify from './pages/verify/index';
import AdminRoute from './components/AdminRoute';
import { isAuthenticated as checkAuth } from './utils/jwt';

function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  // Check if user is authenticated with valid JWT token
  const isAuthenticated = () => {
    return checkAuth();
  };

  // Protected route wrapper
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated() && pathname !== '/login') {
      return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
  };

  return loading ? (
    <Loader />
  ) : (
    <Routes>
      <Route
        path="/login"
        element={
          <>
            <PageTitle title="Login | Face Recognition Authentication" />
            <Auth />
          </>
        }
      />
      <Route
        path="/register"
        element={
          <>
            <PageTitle title="Register | Face Recognition Authentication" />
            <Auth />
          </>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="Dashboard | Face Recognition Authentication" />
              <Dashboard />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/enroll"
        element={
          <>
            <PageTitle title="Enroll | Face Recognition Authentication" />
            <PublicEnroll />
          </>
        }
      />
      <Route
        path="/admin/enroll"
        element={
          <AdminRoute>
            <DefaultLayout>
              <PageTitle title="Admin Enroll | Face Recognition Authentication" />
              <Enroll />
            </DefaultLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/verify"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="Verify | Face Recognition Authentication" />
              <Verify />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recognize"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="Recognize | Face Recognition Authentication" />
              <Recognize />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/face-extractor"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="Face Extractor | Face Recognition Authentication" />
              <FaceExtractor />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="Settings | Face Recognition Authentication" />
              <Settings />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="Attendance | Face Recognition Authentication" />
              <AttendancePage />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="Reports | Face Recognition Authentication" />
              <ReportsPage />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/:id"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="Report Details | Face Recognition Authentication" />
              <ReportDetailPage />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/live-transactions"
        element={
          <Navigate
            to="/attendance"
            replace
          />
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <DefaultLayout>
              <PageTitle title="My Profile | Face Recognition Authentication" />
              <Settings />
            </DefaultLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/enrollment-test"
        element={
          <ProtectedRoute>
            <PageTitle title="Face ID Enrollment Test | Face Recognition Authentication" />
            <EnrollmentTest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/enrollment-demo"
        element={
          <ProtectedRoute>
            <PageTitle title="Face ID Demo | Face Recognition Authentication" />
            <FaceEnrollmentDemo />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <Navigate
            to={isAuthenticated() ? '/dashboard' : '/login'}
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
