import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { apiRequest, getAuthToken, onAuthExpired, setAuthToken } from '../services/api';

interface AuthContextType {
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

interface AuthResponse {
  token: string;
  profile: UserProfile;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const restoringToken = getAuthToken();
      try {
        const result = await apiRequest<{ profile: UserProfile }>('/api/auth/me');
        if (active && getAuthToken() === restoringToken) setUserProfile(result.profile);
      } catch (error) {
        if (getAuthToken() === restoringToken) setAuthToken(null);
        if (
          !(error instanceof Error && 'status' in error && (error.status === 401 || error.status === 404))
        ) {
          console.error('Could not restore the server session:', error);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    const unsubscribe = onAuthExpired(() => {
      setUserProfile(null);
      setLoading(false);
    });
    void restoreSession();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const finishAuthentication = (result: AuthResponse) => {
    setAuthToken(result.token);
    setUserProfile(result.profile);
  };

  const signIn = async (email: string, pass: string) => {
    const result = await apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    finishAuthentication(result);
  };

  const signUp = async (email: string, pass: string, displayName = '') => {
    const result = await apiRequest<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass, displayName }),
    });
    finishAuthentication(result);
  };

  const logout = async () => {
    setAuthToken(null);
    setUserProfile(null);
  };

  const updateCurrentProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    const updated = await apiRequest<UserProfile>(`/api/members/${encodeURIComponent(userProfile.uid)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setUserProfile(updated);
  };

  const isAdmin = userProfile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{ userProfile, isAdmin, loading, signIn, signUp, logout, updateCurrentProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
