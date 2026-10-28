"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import styles from "../components/AuthLayout.module.css";
import {AuthSocialOptions} from "../components/AuthFormControls";
import { ApiFormError } from "@/components/feedback/ApiFormError";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";
import {
  getApiFieldError,
  parseApiValidationError,
  type ApiFieldErrors,
} from "@/lib/api/validation";
import {
  AuthButton,
  AuthInput,
  AuthLayout,
  AuthPasswordInput,
} from "../components/AuthLayout";

function getSafeNextPath() {
  if (typeof window === "undefined") return "";

  const searchParams = new URLSearchParams(window.location.search);
  const next = sanitizeNextPath(searchParams.get("next") ?? "");

  if (!next.startsWith("/") || next.startsWith("//")) return "";
  if (next.includes("://")) return "";

  return next;
}

const SENSITIVE_NEXT_QUERY_KEYS = new Set([
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

function sanitizeNextPath(value: string) {
  if (typeof window === "undefined") return "";

  const rawValue = value.trim();

  if (!rawValue) return "";
  if (!rawValue.startsWith("/")) return "";
  if (rawValue.startsWith("//")) return "";

  try {
    const url = new URL(rawValue, window.location.origin);

    if (url.origin !== window.location.origin) return "";

    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_NEXT_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    const safePath = `${url.pathname}${url.search}${url.hash}`;

    if (safePath === "/login" || safePath.startsWith("/login?")) return "";
    if (safePath === "/signup" || safePath.startsWith("/signup?")) return "";
    if (safePath === "/forgot-password" || safePath.startsWith("/forgot-password?")) return "";

    return safePath;
  } catch {
    return "";
  }
}

export function LoginPageClient() {
  const router = useRouter();
  const { login } = useAuth();

  const [nextPath, setNextPath] = useState("");
  const [values, setValues] = useState({
    email: "",
    password: "",
    remember: true,
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setNextPath(getSafeNextPath());
  }, []);

  function updateField(name: keyof typeof values, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));

    if (fieldErrors[String(name)]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[String(name)];
        return next;
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const session = await login({
        email: values.email,
        password: values.password,
      });

      router.replace(nextPath || getRoleDashboard(session.user.role));
    } catch (err) {
      const parsed = parseApiValidationError(
        err,
        "Unable to login. Please check your details and try again.",
      );

      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      icon={LockKeyhole}
      title="Welcome back"
      description="Sign in to continue to Octalve Console."
      sideTitle="Manage your cloud services securely."
      sideDescription="Access your Octalve Console to manage hosting, domains, billing, orders, support, and services."
    >
      <form method="post" onSubmit={handleSubmit} className={styles.form}>
        <AuthInput
          label="Email address"
          name="email"
          type="email"
          icon={Mail}
          placeholder="you@example.com"
          value={values.email}
          autoComplete="email"
          required
          error={getApiFieldError(fieldErrors, "email")}
          onChange={(event) => updateField("email", event.target.value)}
        />

        <AuthPasswordInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={values.password}
          autoComplete="current-password"
          required
          error={getApiFieldError(fieldErrors, "password")}
          onChange={(event) => updateField("password", event.target.value)}
        />

        <div className={styles.options}>
          <span>Secure account sign-in</span>

          <Link href="/forgot-password" className={styles.link}>
            Forgot password?
          </Link>
        </div>

        <ApiFormError message={error} fieldErrors={fieldErrors} />

        <div className="pt-2">
          <AuthButton disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Logging in...
            </span>
          ) : (
            "Sign in"
          )}
        </AuthButton>
        </div>

        <AuthSocialOptions/>
        <p className={styles.footer}>New to Octalve? <Link href="/signup" className={styles.link}>Create account</Link></p>
      </form>
    </AuthLayout>
  );
}

