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
import {ApiError} from "@/lib/api/client";
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
  authUnavailable: boolean;
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

/** Presentation-only role; explicit server identity only, never fuzzy text/groups. */
export function normalizeUserRole(
 role?: UserRole | string | null,
 isStaff?: boolean,
 isSuperuser?: boolean,
 extraUser?: BackendUser | null,
): UserRole {
 const declared=String(role??extraUser?.role??"").trim().toLowerCase();
 if(declared==="admin" && isSuperuser!==false && extraUser?.is_superuser!==false)return "admin";
 if(declared==="staff" && isStaff!==false && extraUser?.is_staff!==false)return "staff";
 if(declared==="client")return "client";
 if(!declared && isSuperuser===true)return "admin";
 if(!declared && isStaff===true)return "staff";
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
  const [authUnavailable, setAuthUnavailable] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const authenticatedUser = normalizeUser(await authApi.me());
      if (!authenticatedUser.email) throw new Error("No authenticated identity.");
      setUser(authenticatedUser);
      setAuthUnavailable(false);
      return authenticatedUser;
    } catch (error) {
      // A temporary outage must never destroy a previously authenticated
      // browser state. Django/BFF 401 or 403 is explicit session rejection.
      if (error instanceof ApiError && [401,403].includes(error.status)) {
        setUser(null);
        setAuthUnavailable(false);
        return null;
      }
      // Preserve identity, never render a protected page without a valid user.
      setAuthUnavailable(true);
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
    setAuthUnavailable(false);
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
      setAuthUnavailable(false);
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
      authUnavailable,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [user, isLoading, authUnavailable, login, signup, logout, refreshUser],
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
