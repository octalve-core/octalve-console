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

type BackendGroup =
  | string
  | {
      name?: string | null;
      role?: string | null;
    };

type BackendUser = Partial<Omit<User, "id" | "role">> & {
  id?: string | number;
  role?: UserRole | string | null;
  user_type?: string | null;
  account_type?: string | null;
  type?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_admin?: boolean;
  is_client?: boolean;
  groups?: BackendGroup[] | null;
};

type UserFallback = {
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readGroupValues(groups?: BackendGroup[] | null) {
  if (!Array.isArray(groups)) return "";

  return groups
    .map((group) => {
      if (typeof group === "string") return group;
      return `${group.name ?? ""} ${group.role ?? ""}`;
    })
    .join(" ")
    .toLowerCase();
}

export function normalizeUserRole(
  role?: UserRole | string | null,
  isStaff?: boolean,
  isSuperuser?: boolean,
  extraUser?: BackendUser | null,
): UserRole {
  const roleText = String(role ?? "").toLowerCase();
  const userTypeText = String(extraUser?.user_type ?? "").toLowerCase();
  const accountTypeText = String(extraUser?.account_type ?? "").toLowerCase();
  const typeText = String(extraUser?.type ?? "").toLowerCase();
  const groupText = readGroupValues(extraUser?.groups);
  const combined = `${roleText} ${userTypeText} ${accountTypeText} ${typeText} ${groupText}`;

  if (
    isSuperuser ||
    extraUser?.is_superuser ||
    extraUser?.is_admin ||
    combined.includes("superuser") ||
    combined.includes("administrator") ||
    combined.includes("admin")
  ) {
    return "admin";
  }

  if (
    isStaff ||
    extraUser?.is_staff ||
    combined.includes("staff") ||
    combined.includes("support") ||
    combined.includes("agent")
  ) {
    return "staff";
  }

  return "client";
}

export function getRoleDashboard(role?: UserRole | string | null) {
  const normalizedRole = normalizeUserRole(role);

  if (normalizedRole === "admin") return "/admin";
  if (normalizedRole === "staff") return "/staff";
  return "/client";
}

function normalizeUser(
  user: BackendUser | User | null | undefined,
  fallback: UserFallback = {},
): User {
  const backendUser = user as BackendUser | undefined;
  const fullName = [backendUser?.first_name, backendUser?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: String(
      backendUser?.id ?? fallback.id ?? fallback.email ?? "octalve-user",
    ),
    name:
      backendUser?.name ??
      backendUser?.full_name ??
      fullName ??
      fallback.name ??
      backendUser?.email ??
      fallback.email ??
      "Octalve User",
    email: backendUser?.email ?? fallback.email ?? "",
    role: normalizeUserRole(
      backendUser?.role ?? fallback.role,
      backendUser?.is_staff,
      backendUser?.is_superuser,
      backendUser,
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

async function syncMiddlewareSession(
  access?: string | null,
  refresh?: string | null,
) {
  if (typeof window === "undefined" || !access) return;

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      access,
      refresh,
    }),
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to secure frontend session.");
  }
}

async function syncMiddlewareSessionFromStorage() {
  const accessToken = tokenStorage.getAccessToken();

  if (!accessToken) return;

  await syncMiddlewareSession(accessToken, tokenStorage.getRefreshToken());
}

async function clearMiddlewareSession() {
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/auth/session", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    // Always continue with local token cleanup.
  }
}

async function clearClientSession() {
  await clearMiddlewareSession();
  tokenStorage.clearTokens();
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
      await clearMiddlewareSession();
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const currentUser = normalizeUser(await authApi.me());

      await syncMiddlewareSessionFromStorage();

      setUser(currentUser);
      return currentUser;
    } catch {
      await clearClientSession();
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

    await syncMiddlewareSession(
      normalizedSession.access,
      normalizedSession.refresh,
    );

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

      await syncMiddlewareSession(
        normalizedSession.access,
        normalizedSession.refresh,
      );

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

    await syncMiddlewareSession(authSession.access, authSession.refresh);

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
      await clearClientSession();
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
