"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiFormError } from "@/components/feedback/ApiFormError";
import { FieldError } from "@/components/forms/FieldError";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";
import {
  getApiFieldError,
  parseApiValidationError,
  type ApiFieldErrors,
} from "@/lib/api/validation";

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
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setNextPath(getSafeNextPath());
  }, []);

  function updateField(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[name];
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
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] px-4 py-10">
      <Card className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
            <LockKeyhole className="h-7 w-7" />
          </div>

          <h1 className="mt-6 text-3xl font-medium tracking-[-0.05em] text-slate-950">
            Login to Octalve Console
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Access your secure hosting dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <Input
              label="Email address"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={values.email}
              autoComplete="email"
              required
              onChange={(event) => updateField("email", event.target.value)}
            />
            <FieldError message={getApiFieldError(fieldErrors, "email")} />
          </div>

          <div>
            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="Enter password"
              value={values.password}
              autoComplete="current-password"
              required
              onChange={(event) => updateField("password", event.target.value)}
            />
            <FieldError message={getApiFieldError(fieldErrors, "password")} />
          </div>

          <ApiFormError message={error} fieldErrors={fieldErrors} />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <a href="/forgot-password" className="font-medium text-[#0064E0]">
              Forgot password?
            </a>
            <a href="/signup" className="font-medium text-[#0064E0]">
              Create account
            </a>
          </div>
        </form>
      </Card>
    </main>
  );
}