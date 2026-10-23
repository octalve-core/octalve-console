import { NextRequest, NextResponse } from "next/server";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const ACCESS_COOKIE = IS_PRODUCTION
  ? "__Host-octalve_console_access"
  : "octalve_console_access";

const REFRESH_COOKIE = IS_PRODUCTION
  ? "__Host-octalve_console_refresh"
  : "octalve_console_refresh";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://api.cloud.octalve.com/api";

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

const PROTECTED_PREFIXES = ["/admin", "/client", "/staff"];

const AUTH_ENTRY_ROUTES = new Set(["/login", "/signup"]);

const SENSITIVE_QUERY_KEYS = new Set([
  "password",
  "new_password",
  "re_new_password",
  "re_password",
  "current_password",
  "token",
  "access",
  "refresh",
  "secret",
  "secret_key",
  "api_key",
]);

const REDIRECT_QUERY_KEYS = new Set([
  "next",
  "redirect",
  "redirect_to",
  "return",
  "return_to",
  "callback",
  "callback_url",
  "callbackUrl",
]);

type ConsoleRole = "admin" | "staff" | "client";

type BackendGroup =
  | string
  | {
      name?: string | null;
      role?: string | null;
    };

type BackendUser = {
  role?: string | null;
  user_type?: string | null;
  account_type?: string | null;
  type?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_admin?: boolean;
  is_client?: boolean;
  groups?: BackendGroup[] | null;
};

type SessionCheck = {
  user: BackendUser | null;
  access?: string;
  refresh?: string;
};

const cookieBase = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
  path: "/",
};

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

function normalizeRole(user: BackendUser | null): ConsoleRole {
  const com...[truncated]