'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { api, setApiUrl, clearApiUrl, setEnvironment, clearEnvironment, getCurrentEnvironment } from '@/lib/api';
import { loadTypeDefinitions } from '@/lib/column-type-registry';
import { getStorageItem, setStorageItem, removeStorageItem, STORAGE_KEYS } from '@/lib/storage-utils';

interface User {
  id: number;
  name: string;
  email: string;
  permissions: string[];
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string, passwordConfirmation: string) => Promise<{ success: boolean; errors?: string[] }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  /** Handle token received from cross-domain redirect (stores token and verifies with API) */
  handleTokenFromRedirect: (token: string, apiUrl?: string, environment?: string) => Promise<boolean>;
  loading: boolean;
  isAuthenticated: boolean;
  /** Get current API environment ('production', 'beta', 'staging') */
  getEnvironment: () => string;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
  errors?: string[];
  /** API URL for the company's chosen environment (returned from login) */
  api_url?: string;
  /** Frontend URL for the company's chosen environment (returned from login) */
  frontend_url?: string;
  /** Environment name ('production', 'beta', 'staging') */
  environment?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper to set auth token in both localStorage and cookie (for SSR)
const setAuthToken = (token: string) => {
  setStorageItem(STORAGE_KEYS.TOKEN, token);
  // Set cookie for server-side access (expires in 7 days)
  document.cookie = `auth_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
};

// Helper to clear auth token from both localStorage and cookie
const clearAuthToken = () => {
  removeStorageItem(STORAGE_KEYS.TOKEN);
  document.cookie = 'auth_token=; path=/; max-age=0';
};

// Helper to read auth token from cookie (for recovery after localStorage clear)
const getAuthTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/);
  return match ? match[1] : null;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const devModeBypass = process.env.NEXT_PUBLIC_DEV_MODE_AUTH_BYPASS === 'true';
  const { setTheme } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  // Prevent duplicate auth checks (React StrictMode double-mount)
  const authCheckingRef = useRef(false);

  // Apply user's preferred theme when they log in
  const applyUserTheme = (userData: User) => {
    const preferredTheme = userData.preferred_theme as string | undefined;
    if (preferredTheme && ['light', 'dark', 'system'].includes(preferredTheme)) {
      setTheme(preferredTheme);
    }
  };

  // Initialize token from localStorage (client-side only)
  // Also sync to cookie for server-side rendering access
  // If localStorage is empty (e.g., hard refresh with cache clear), recover from cookie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let storedToken = getStorageItem<string>(STORAGE_KEYS.TOKEN, '');

      // If localStorage is empty but cookie exists, recover session from cookie
      // This handles the case where user clears cache but cookie persists
      if (!storedToken) {
        const cookieToken = getAuthTokenFromCookie();
        if (cookieToken) {
          // Restore to localStorage for future page loads
          setStorageItem(STORAGE_KEYS.TOKEN, cookieToken);
          storedToken = cookieToken;
        }
      }

      if (storedToken) {
        // Ensure cookie is in sync with localStorage for SSR
        document.cookie = `auth_token=${storedToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }
      setToken(storedToken || null);
      setTokenChecked(true);
    }
  }, []);

  useEffect(() => {
    // Wait until we've checked localStorage for token
    if (!tokenChecked) return;

    // Auto-login in dev mode - skip API calls entirely
    if (devModeBypass) {
      devLogin();
      return;
    }

    // If we already have a user (from login/signup), don't re-check
    if (user) {
      setLoading(false);
      return;
    }

    if (token) {
      // Prevent duplicate auth checks on React StrictMode double-mount
      if (authCheckingRef.current) return;
      authCheckingRef.current = true;
      // Verify token and get user info
      checkAuth();
    } else {
      setLoading(false);
    }

  }, [token, tokenChecked, devModeBypass]);

  const checkAuth = async () => {
    try {
      const response = await api.get<AuthResponse>('/api/v1/auth/me');
      if (response.success && response.user) {
        // Check if we need to redirect to a different frontend (auto-login environment check)
        // Same logic as login - if frontend_url differs from current origin, redirect
        if (
          response.frontend_url &&
          typeof window !== 'undefined' &&
          response.frontend_url !== window.location.origin
        ) {
          // Get existing token from localStorage
          const existingToken = getStorageItem<string>(STORAGE_KEYS.TOKEN, '');
          if (existingToken) {
            // Redirect to the correct frontend with token for cross-domain login
            const redirectUrl = new URL('/login', response.frontend_url);
            redirectUrl.searchParams.set('token', existingToken);
            redirectUrl.searchParams.set('redirect', window.location.pathname);
            if (response.api_url) {
              redirectUrl.searchParams.set('api_url', response.api_url);
            }
            if (response.environment) {
              redirectUrl.searchParams.set('environment', response.environment);
            }
            console.log('Auto-login redirect: wrong frontend, redirecting to', response.frontend_url);
            window.location.href = redirectUrl.toString();
            return; // Don't setLoading(false) - page is redirecting
          }
        }

        setUser(response.user);
        applyUserTheme(response.user);
        // Load column type definitions from SSoT (fires in background)
        loadTypeDefinitions();
      } else {
        logout();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
      authCheckingRef.current = false;
    }
  };

  const devLogin = async () => {
    console.log('🔧 Dev Mode: Auto-logging in with mock user...');

    // Use a mock user for dev mode - no API call needed
    const mockUser: User = {
      id: 1,
      name: 'Jake Baird',
      email: 'jake@teeem.com.au',
      permissions: ['view_jobs', 'edit_jobs', 'view_contacts', 'edit_contacts', 'view_estimates', 'edit_estimates', 'view_purchase_orders', 'edit_purchase_orders', 'admin'],
      preferred_theme: 'dark' // Jake prefers dark mode
    };

    const mockToken = 'dev-mode-token';
    setAuthToken(mockToken);
    setToken(mockToken);
    setUser(mockUser);
    applyUserTheme(mockUser);
    // Load column type definitions from SSoT (fires in background)
    loadTypeDefinitions();
    console.log('✅ Dev Mode: Logged in as', mockUser.name);
    setLoading(false);
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Use loginToProduction - production backend is the "router" that returns api_url
      // for the company's chosen environment
      const response = await api.loginToProduction<AuthResponse>({
        user: { email, password }
      });

      if (response?.success && response.token && response.user) {
        // Check if we need to redirect to a different frontend deployment
        // (e.g., staging company → teeem-staging.vercel.app)
        if (
          response.frontend_url &&
          typeof window !== 'undefined' &&
          response.frontend_url !== window.location.origin
        ) {
          // Redirect to the correct frontend with token in URL for cross-domain login
          const redirectUrl = new URL('/login', response.frontend_url);
          redirectUrl.searchParams.set('token', response.token);
          redirectUrl.searchParams.set('redirect', '/dashboard');
          if (response.api_url) {
            redirectUrl.searchParams.set('api_url', response.api_url);
          }
          if (response.environment) {
            redirectUrl.searchParams.set('environment', response.environment);
          }
          window.location.href = redirectUrl.toString();
          // Return success but the page will redirect
          return { success: true };
        }

        setAuthToken(response.token);
        setToken(response.token);
        setUser(response.user);
        applyUserTheme(response.user);

        // Store the API URL and environment from login response
        // This enables environment switching - frontend will use api_url for all subsequent requests
        if (response.api_url) {
          setApiUrl(response.api_url);
        }
        if (response.environment) {
          setEnvironment(response.environment);
        }

        // Load column type definitions from SSoT (fires in background)
        loadTypeDefinitions();
        return { success: true };
      } else {
        return { success: false, error: response?.error || 'Login failed' };
      }
    } catch (error) {
      const err = error as Error & { data?: { error?: string } };
      return {
        success: false,
        error: err.data?.error || err.message || 'Login failed. Please try again.'
      };
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string
  ): Promise<{ success: boolean; errors?: string[] }> => {
    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/signup', {
        user: {
          name,
          email,
          password,
          password_confirmation: passwordConfirmation
        }
      });

      if (response?.success && response.token && response.user) {
        setAuthToken(response.token);
        setToken(response.token);
        setUser(response.user);
        applyUserTheme(response.user);
        // Load column type definitions from SSoT (fires in background)
        loadTypeDefinitions();
        return { success: true };
      } else {
        return { success: false, errors: response?.errors || ['Signup failed'] };
      }
    } catch (error) {
      const err = error as Error & { data?: { errors?: string[] } };
      return {
        success: false,
        errors: err.data?.errors || ['Signup failed. Please try again.']
      };
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      clearAuthToken();
      // Clear the stored API URL and environment on logout
      clearApiUrl();
      clearEnvironment();
    }
    setToken(null);
    setUser(null);
    // Reset theme to default so next login applies user's database preference
    setTheme('light');
  };

  // Get the current API environment
  const getEnvironment = () => getCurrentEnvironment();

  const refreshUser = async () => {
    if (devModeBypass) {
      // In dev mode, just keep the mock user
      return;
    }
    await checkAuth();
  };

  // Handle token received from cross-domain redirect
  // This is called by the login page when it receives a token via URL params
  const handleTokenFromRedirect = async (
    tokenFromUrl: string,
    apiUrl?: string,
    environment?: string
  ): Promise<boolean> => {
    // Store the token
    setAuthToken(tokenFromUrl);
    setToken(tokenFromUrl);

    // Store api_url and environment if provided
    if (apiUrl) {
      setApiUrl(apiUrl);
    }
    if (environment) {
      setEnvironment(environment);
    }

    // Verify the token with the backend
    try {
      const response = await api.get<AuthResponse>('/api/v1/auth/me');
      if (response.success && response.user) {
        setUser(response.user);
        applyUserTheme(response.user);
        loadTypeDefinitions();
        setLoading(false);
        return true;
      } else {
        // Token invalid - clear everything
        logout();
        return false;
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    signup,
    logout,
    refreshUser,
    handleTokenFromRedirect,
    loading,
    isAuthenticated: !!user,
    getEnvironment
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
