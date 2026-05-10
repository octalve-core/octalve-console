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
  AuthInput,
  AuthPasswordInput,
  AuthShell,
  AuthSubmitButton,
} from "../components/AuthShell";

function getSafeNextPath() {
  if (typeof window === "undefined") return "";

  const searchParams = new URLSearchParams(window.location.search);
  const next = searchParams.get("next") ?? "";

  if (!next.startsWith("/") || next.startsWith("//")) return "";
  if (next.includes("://")) return "";

  return next;
}

export function LoginView() {
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
    <AuthShell
      icon={LockKeyhole}
      title="Welcome back"
      description="Sign in to continue to Octalve Console."
      sideTitle="Manage your cloud services with confidence."
      sideDescription="Sign in to manage hosting services, domains, invoices, orders, support tickets, and account operations in one secure workspace."
      sideFooter="Access is protected with secure authentication, role-based permissions, and backend-controlled account data."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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

        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={values.remember}
              onChange={(event) => updateField("remember", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#0064E0] focus:ring-[#0064E0]"
            />
            Remember me
          </label>

          <Link href="/forgot-password" className="text-sm font-semibold text-[#0064E0] hover:text-[#0057C2]">
            Forgot password?
          </Link>
        </div>

        <ApiFormError message={error} fieldErrors={fieldErrors} />

        <AuthSubmitButton disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Logging in...
            </span>
          ) : (
            "Login"
          )}
        </AuthSubmitButton>

        <div className="relative py-2 text-center">
          <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
          <span className="relative bg-white px-4 text-sm text-slate-400">
            Don&apos;t have an account?
          </span>
        </div>

        <Link
          href="/signup"
          className="flex h-14 w-full items-center justify-center rounded-2xl border border-[#D7E3F2] bg-white text-sm font-semibold text-[#0064E0] transition hover:border-[#0064E0]/40 hover:bg-[#F8FBFF]"
        >
          Create account
        </Link>
      </form>
    </AuthShell>
  );
}