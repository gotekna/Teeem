'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { api } from '@/lib/api';
import { loadTypeDefinitions } from '@/lib/column-type-registry';

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
  loading: boolean;
  isAuthenticated: boolean;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
  errors?: string[];
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper to set auth token in both localStorage and cookie (for SSR)
const setAuthToken = (token: string) => {
  localStorage.setItem('token', token);
  // Set cookie for server-side access (expires in 7 days)
  document.cookie = `auth_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
};

// Helper to clear auth token from both localStorage and cookie
const clearAuthToken = () => {
  localStorage.removeItem('token');
  document.cookie = 'auth_token=; path=/; max-age=0';
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

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  // Prevent duplicate auth checks (React StrictMode double-mount)
  const authCheckingRef = useRef(false);

  // Initialize token from localStorage (client-side only)
  // Also sync to cookie for server-side rendering access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        // Ensure cookie is in sync with localStorage for SSR
        document.cookie = `auth_token=${storedToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }
      setToken(storedToken);
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
        setUser(response.user);
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
      email: 'jake@tekna.com.au',
      permissions: ['view_jobs', 'edit_jobs', 'view_contacts', 'edit_contacts', 'view_estimates', 'edit_estimates', 'view_purchase_orders', 'edit_purchase_orders', 'admin']
    };

    const mockToken = 'dev-mode-token';
    setAuthToken(mockToken);
    setToken(mockToken);
    setUser(mockUser);
    // Load column type definitions from SSoT (fires in background)
    loadTypeDefinitions();
    console.log('✅ Dev Mode: Logged in as', mockUser.name);
    setLoading(false);
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/login', {
        user: { email, password }
      });

      if (response?.success && response.token && response.user) {
        setAuthToken(response.token);
        setToken(response.token);
        setUser(response.user);
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
    }
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (devModeBypass) {
      // In dev mode, just keep the mock user
      return;
    }
    await checkAuth();
  };

  const value: AuthContextType = {
    user,
    login,
    signup,
    logout,
    refreshUser,
    loading,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
