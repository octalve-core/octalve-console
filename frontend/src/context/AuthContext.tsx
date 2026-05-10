"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApiV2, type AuthTokenResponse } from "@/lib/api/modules/auth.api";
import { tokenStorage } from "@/lib/api/client";
import type {
  AuthSession,
  LoginPayload,
  SignupPayload,
  User,
  UserRole,
} from "@/lib/api/types";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthSession>;
  signup: (payload: SignupPayload) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
};

type BackendUser = Partial<Omit<User, "id" | "role">> & {
  id?: string | number;
  role?: UserRole | string | null;
  full_name?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
};

type UserFallback = {
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
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
      role: "admin",
    },
  },
  {
    email: "staff@octalve.cloud",
    password: "password123",
    user: {
      id: "demo-staff",
      name: "Octalve Staff",
      email: "staff@octalve.cloud",
      role: "staff",
    },
  },
  {
    email: "client@octalve.cloud",
    password: "password123",
    user: {
      id: "demo-client",
      name: "Octalve Client",
      email: "client@octalve.cloud",
      role: "client",
    },
  },
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
  tokenStorage.setTokens(session.access, session.refresh ?? "");
  saveLocalUser(session.user);
}

function normalizeUserRole(
  role?: UserRole | string | null,
  isStaff?: boolean,
  isSuperuser?: boolean,
): UserRole {
  const normalizedRole = String(role ?? "").toLowerCase();

  if (normalizedRole === "admin") return "admin";
  if (normalizedRole === "staff") return "staff";
  if (normalizedRole === "client") return "client";

  if (isSuperuser) return "admin";
  if (isStaff) return "staff";

  return "client";
}

function normalizeUser(
  user: BackendUser | User | null | undefined,
  fallback: UserFallback = {},
): User {
  const backendUser = user as BackendUser | undefined;
  const email = backendUser?.email ?? fallback.email ?? "";

  return {
    id: String(backendUser?.id ?? fallback.id ?? email ?? "octalve-user"),
    name:
      backendUser?.name ??
      backendUser?.full_name ??
      fallback.name ??
      email ??
      "Octalve User",
    email,
    role: normalizeUserRole(
      backendUser?.role,
      backendUser?.is_staff,
      backendUser?.is_superuser,
    ),
    avatar_url: backendUser?.avatar_url ?? null,
    full_name: backendUser?.full_name ?? backendUser?.name ?? fallback.name,
    username: backendUser?.username,
    phone_number: backendUser?.phone_number,
    referral_code: backendUser?.referral_code,
    is_staff: backendUser?.is_staff,
    is_superuser: backendUser?.is_superuser,
    is_active: backendUser?.is_active,
    date_joined: backendUser?.date_joined,
    last_login: backendUser?.last_login,
  };
}

async function resolveLoginSession(
  loginResponse: AuthTokenResponse,
  fallback: UserFallback = {},
): Promise<AuthSession> {
  tokenStorage.setTokens(loginResponse.access, loginResponse.refresh ?? "");

  const resolvedUser = loginResponse.user
    ? normalizeUser(loginResponse.user, fallback)
    : normalizeUser(await authApiV2.me(), fallback);

  return {
    access: loginResponse.access,
    refresh: loginResponse.refresh,
    user: resolvedUser,
  };
}

function createDemoLoginSession(payload: LoginPayload): AuthSession | null {
  const email = payload.email.trim().toLowerCase();

  const record = demoUsers.find(
    (item) => item.email === email && item.password === payload.password,
  );

  if (!record) return null;

  return {
    access: `demo-access-${record.user.role}`,
    refresh: `demo-refresh-${record.user.role}`,
    user: record.user,
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
      const currentUser = normalizeUser(await authApiV2.me());
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
      const loginResponse = await authApiV2.login(payload);
      const session = await resolveLoginSession(loginResponse, {
        email: payload.email,
      });

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
    await authApiV2.register(payload);

    const loginResponse = await authApiV2.login({
      email: payload.email,
      password: payload.password,
    });

    const session = await resolveLoginSession(loginResponse, {
      name: payload.full_name,
      email: payload.email,
      role: "client",
    });

    storeSession(session);
    setUser(session.user);
    return session;
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = tokenStorage.getAccessToken();

      if (token && !token.startsWith("demo-access-")) {
        await authApiV2.logout();
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
      refreshUser,
    }),
    [user, isLoading, login, signup, logout, refreshUser],
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
