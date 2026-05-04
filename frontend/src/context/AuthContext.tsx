"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { authApi } from "@/lib/api/endpoints";
import { tokenStorage } from "@/lib/api/client";
import type { AuthSession, LoginPayload, SignupPayload, User, UserRole } from "@/lib/api/types";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthSession>;
  signup: (payload: SignupPayload) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_USER_KEY = "octalve_console_demo_user";

const demoUsers: Array<{ email: string; password: string; user: User }> = [
  {
    email: "admin@octalve.cloud",
    password: "password123",
    user: {
      id: "demo-admin",
      name: "Octalve Admin",
      email: "admin@octalve.cloud",
      role: "admin"
    }
  },
  {
    email: "staff@octalve.cloud",
    password: "password123",
    user: {
      id: "demo-staff",
      name: "Octalve Staff",
      email: "staff@octalve.cloud",
      role: "staff"
    }
  },
  {
    email: "client@octalve.cloud",
    password: "password123",
    user: {
      id: "demo-client",
      name: "Octalve Client",
      email: "client@octalve.cloud",
      role: "client"
    }
  }
];

export function getRoleDashboard(role?: UserRole | string | null) {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/client";
}

function saveLocalUser(user: User) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
}

function readLocalUser() {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(DEMO_USER_KEY);
    return value ? (JSON.parse(value) as User) : null;
  } catch {
    return null;
  }
}

function clearLocalUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_USER_KEY);
}

function storeSession(session: AuthSession) {
  tokenStorage.setTokens(session.access, session.refresh);
  saveLocalUser(session.user);
}

function createDemoLoginSession(payload: LoginPayload): AuthSession | null {
  const email = payload.email.trim().toLowerCase();

  const record = demoUsers.find(
    (item) => item.email === email && item.password === payload.password
  );

  if (!record) return null;

  return {
    access: `demo-access-${record.user.role}`,
    refresh: `demo-refresh-${record.user.role}`,
    user: record.user
  };
}

function createDemoSignupSession(payload: SignupPayload): AuthSession {
  const user: User = {
    id: "demo-client-new",
    name: payload.full_name,
    email: payload.email,
    role: "client"
  };

  return {
    access: "demo-access-client",
    refresh: "demo-refresh-client",
    user
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = tokenStorage.getAccessToken();

    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    if (token.startsWith("demo-access-")) {
      const storedUser = readLocalUser();
      setUser(storedUser);
      setIsLoading(false);
      return storedUser;
    }

    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      saveLocalUser(currentUser);
      return currentUser;
    } catch {
      tokenStorage.clearTokens();
      clearLocalUser();
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    try {
      const session = await authApi.login(payload);
      storeSession(session);
      setUser(session.user);
      return session;
    } catch (error) {
      const demoSession = createDemoLoginSession(payload);

      if (demoSession) {
        storeSession(demoSession);
        setUser(demoSession.user);
        return demoSession;
      }

      throw error;
    }
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    try {
      const session = await authApi.signup(payload);
      storeSession(session);
      setUser(session.user);
      return session;
    } catch {
      const demoSession = createDemoSignupSession(payload);
      storeSession(demoSession);
      setUser(demoSession.user);
      return demoSession;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = tokenStorage.getAccessToken();

      if (token && !token.startsWith("demo-access-")) {
        await authApi.logout();
      }
    } catch {
      // Clear frontend session even if backend logout fails.
    } finally {
      tokenStorage.clearTokens();
      clearLocalUser();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      signup,
      logout,
      refreshUser
    }),
    [user, isLoading, login, signup, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
