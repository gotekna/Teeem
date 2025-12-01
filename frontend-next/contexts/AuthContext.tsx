'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

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

  // Initialize token from localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(localStorage.getItem('token'));
    }
  }, []);

  useEffect(() => {
    // Auto-login in dev mode - skip API calls entirely
    if (devModeBypass) {
      devLogin();
      return;
    }

    if (token) {
      // Verify token and get user info
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [token, devModeBypass]);

  const checkAuth = async () => {
    try {
      const response = await api.get<AuthResponse>('/api/v1/auth/me');
      if (response.success && response.user) {
        setUser(response.user);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
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
    localStorage.setItem('token', mockToken);
    setToken(mockToken);
    setUser(mockUser);
    console.log('✅ Dev Mode: Logged in as', mockUser.name);
    setLoading(false);
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/login', {
        user: { email, password }
      });

      if (response?.success && response.token && response.user) {
        localStorage.setItem('token', response.token);
        setToken(response.token);
        setUser(response.user);
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
        localStorage.setItem('token', response.token);
        setToken(response.token);
        setUser(response.user);
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
      localStorage.removeItem('token');
    }
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
