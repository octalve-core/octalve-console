"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
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
  const next = searchParams.get("next") ?? "";

  if (!next.startsWith("/") || next.startsWith("//")) return "";
  if (next.includes("://")) return "";

  return next;
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
      sideDescription="Access your Octalve Cloud workspace for hosting, domains, billing, orders, support, and service management."
    >
      <form onSubmit={handleSubmit} className="auth-form-stack">
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

        <div className="auth-inline-row">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={values.remember}
              onChange={(event) => updateField("remember", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-[#0064E0]"
            />
            Remember me
          </label>

          <Link href="/forgot-password" className="text-sm font-medium text-[#0064E0] hover:text-[#0057C2]">
            Forgot password?
          </Link>
        </div>

        <ApiFormError message={error} fieldErrors={fieldErrors} />

        <div className="auth-submit-zone">
          <AuthButton disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Logging in...
            </span>
          ) : (
            "Login"
          )}
        </AuthButton>
        </div>

        <p className="auth-helper-text">
          Don&apos;t have an account?
        </p>

        <Link
          href="/signup"
          className="auth-secondary-link auth-form-footer-gap"
        >
          Create account
        </Link>
      </form>
    </AuthLayout>
  );
}