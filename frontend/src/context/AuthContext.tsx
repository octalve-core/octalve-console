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
import { authApi } from "@/lib/api/endpoints";
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

export function getRoleDashboard(role?: UserRole | string | null) {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/client";
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

  return {
    id: String(
      backendUser?.id ?? fallback.id ?? fallback.email ?? "octalve-user",
    ),
    name:
      backendUser?.name ??
      backendUser?.full_name ??
      fallback.name ??
      backendUser?.email ??
      fallback.email ??
      "Octalve User",
    email: backendUser?.email ?? fallback.email ?? "",
    role: normalizeUserRole(
      backendUser?.role,
      backendUser?.is_staff,
      backendUser?.is_superuser,
    ),
  };
}

function isAuthSession(value: unknown): value is AuthSession {
  const session = value as Partial<AuthSession> | undefined;

  return Boolean(
    session &&
    typeof session === "object" &&
    typeof session.access === "string" &&
    session.user,
  );
}

function storeSession(session: AuthSession) {
  tokenStorage.setTokens(session.access, session.refresh);
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

    try {
      const currentUser = normalizeUser(await authApi.me());
      setUser(currentUser);
      return currentUser;
    } catch {
      tokenStorage.clearTokens();
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
    const session = await authApi.login({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    });

    const normalizedSession: AuthSession = {
      ...session,
      user: normalizeUser(session.user),
    };

    storeSession(normalizedSession);
    setUser(normalizedSession.user);

    return normalizedSession;
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const signupResponse = await authApi.signup(payload);

    if (isAuthSession(signupResponse)) {
      const normalizedSession: AuthSession = {
        ...signupResponse,
        user: normalizeUser(signupResponse.user, {
          name: payload.full_name,
          email: payload.email,
          role: "client",
        }),
      };

      storeSession(normalizedSession);
      setUser(normalizedSession.user);

      return normalizedSession;
    }

    const loginSession = await authApi.login({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    });

    const authSession: AuthSession = {
      ...loginSession,
      user: normalizeUser(loginSession.user, {
        name: payload.full_name,
        email: payload.email,
        role: "client",
      }),
    };

    storeSession(authSession);
    setUser(authSession.user);

    return authSession;
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = tokenStorage.getAccessToken();

      if (token) {
        await authApi.logout();
      }
    } catch {
      // Always clear client session even if backend logout is unavailable.
    } finally {
      tokenStorage.clearTokens();
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