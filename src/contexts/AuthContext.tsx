import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '@/lib/types';
import { mockTeacher, mockStudent } from '@/lib/mock-data';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginAsStudent: () => void;
  logout: () => void;
  isTeacher: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Mock teacher login
    if (email && password) {
      setUser(mockTeacher);
      return true;
    }
    return false;
  };

  const loginAsStudent = () => {
    setUser(mockStudent);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      loginAsStudent,
      logout,
      isTeacher: user?.role === 'teacher',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
