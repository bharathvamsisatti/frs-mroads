import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticatedAdmin } from '../utils/jwt';

interface AdminRouteProps {
    children: React.ReactNode;
}

/**
 * Protected route component for admin-only pages
 * Checks for valid JWT token with admin role
 * Redirects to login if not authenticated or not admin
 */
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const isAdmin = isAuthenticatedAdmin();

    if (!isAdmin) {
        // Redirect to login if not authenticated as admin
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
