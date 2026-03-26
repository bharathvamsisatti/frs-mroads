/**
 * JWT utilities for client-side token handling
 */

export interface JwtPayload {
    user_id: string;
    email: string;
    name: string;
    role: string;
    exp: number;
}

/**
 * Decode JWT token without verification
 * Note: This is for client-side parsing only. Server must verify the signature.
 */
export function decodeToken(token: string): JwtPayload | null {
    try {
        // Check if token exists and is valid
        if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
            return null;
        }

        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
}

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
    try {
        const payload = decodeToken(token);
        if (!payload || !payload.exp) {
            return true;
        }

        // exp is in seconds, Date.now() is in milliseconds
        const currentTime = Date.now() / 1000;
        return payload.exp < currentTime;
    } catch (error) {
        console.error('Error checking token expiration:', error);
        return true;
    }
}

/**
 * Get user role from JWT token
 */
export function getUserRole(token: string): string | null {
    try {
        const payload = decodeToken(token);
        return payload?.role || null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

/**
 * Check if user has admin role
 */
export function isAdmin(token: string): boolean {
    const role = getUserRole(token);
    return role === 'admin';
}

/**
 * Get current valid token from localStorage
 * Returns null if token is missing or expired
 */
export function getValidToken(): string | null {
    const token = localStorage.getItem('token');
    if (!token) {
        return null;
    }

    if (isTokenExpired(token)) {
        // Clean up expired token
        localStorage.removeItem('token');
        return null;
    }

    return token;
}

/**
 * Get user info from current token
 */
export function getCurrentUser(): JwtPayload | null {
    const token = getValidToken();
    if (!token) {
        return null;
    }

    return decodeToken(token);
}

/**
 * Check if user is authenticated with a valid token
 */
export function isAuthenticated(): boolean {
    return getValidToken() !== null;
}

/**
 * Check if current user is authenticated as admin
 */
export function isAuthenticatedAdmin(): boolean {
    const token = getValidToken();
    if (!token) {
        return false;
    }

    return isAdmin(token);
}
