"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
  googleId?: string;
  course?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loginWithGoogleData: (data: {
    sub: string;
    name: string;
    email: string;
    picture?: string;
  }) => void;
  loginAsStudent: (name: string, email: string) => void;
  logout: () => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "pet_bsi_user_profile";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Carrega perfil salvo do localStorage ao iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Erro ao carregar perfil salvo", e);
    }
  }, []);

  const saveUser = (newUser: UserProfile | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  };

  const loginWithGoogleData = (data: {
    sub: string;
    name: string;
    email: string;
    picture?: string;
  }) => {
    const googleUser: UserProfile = {
      id: data.sub,
      name: data.name,
      email: data.email,
      picture: data.picture,
      googleId: data.sub,
      course: "Sistemas de Informação",
    };

    saveUser(googleUser);
    setIsProfileOpen(false);
  };

  const loginAsStudent = (name: string, email: string) => {
    const studentUser: UserProfile = {
      id: `student-${Date.now()}`,
      name: name.trim() || "Aluno",
      email: email.trim() || "aluno@bsi.edu.br",
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim() || "Aluno")}&backgroundColor=30135d&textColor=ffffff`,
      course: "Sistemas de Informação",
    };

    saveUser(studentUser);
    setIsProfileOpen(false);
  };

  const logout = () => {
    saveUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithGoogleData,
        loginAsStudent,
        logout,
        isProfileOpen,
        setIsProfileOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
