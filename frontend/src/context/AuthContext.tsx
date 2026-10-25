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
  username?: string | null;
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
      backendUser?.username ??
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

async function clearBrowserSession() {
  // Compatible with old sessions, but never reads a JWT into JavaScript.
  try {
    await fetch("/api/auth/session", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    // Backend logout is authoritative; local state is also cleared.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const authenticatedUser = normalizeUser(await authApi.me());
      if (!authenticatedUser.email) throw new Error("No authenticated identity.");
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refreshUser(); }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload): Promise<AuthSession> => {
    const response = await authApi.login({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    });
    const authenticatedUser = normalizeUser(response.user);
    if (!authenticatedUser.email) {
      throw new Error("Server did not verify the authenticated identity.");
    }
    setUser(authenticatedUser);
    return { user: authenticatedUser };
  }, []);

  const signup = useCallback(async (payload: SignupPayload): Promise<AuthSession> => {
    const response = await authApi.signup(payload);
    const authenticatedUser = normalizeUser(response.user);
    if (!authenticatedUser.email) {
      throw new Error("Server did not verify the new account.");
    }
    setUser(authenticatedUser);
    return { user: authenticatedUser };
  }, []);

  const logout = useCallback(async () => {
    let revokeFailed = false;
    try {
      await authApi.logout();
    } catch {
      revokeFailed = true;
    } finally {
      await clearBrowserSession();
      setUser(null);
    }
    if (revokeFailed) {
      throw new Error("Signed out locally; server token revocation could not be verified.");
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
