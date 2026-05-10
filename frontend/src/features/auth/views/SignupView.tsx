"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserRoundPlus } from "lucide-react";
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

export function SignupView() {
  const router = useRouter();
  const { signup } = useAuth();

  const [values, setValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (values.password !== values.confirmPassword) {
      setFieldErrors({
        confirmPassword: ["Passwords do not match."],
      });
      setError("Please correct the highlighted fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await signup({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });

      router.replace(getRoleDashboard(session.user.role));
    } catch (err) {
      const parsed = parseApiValidationError(
        err,
        "Unable to create account. Please check the form and try again.",
      );

      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] px-4 py-10">
      <Card className="w-full max-w-lg">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
            <UserRoundPlus className="h-7 w-7" />
          </div>

          <h1 className="mt-6 text-3xl font-medium tracking-[-0.05em] text-slate-950">
            Create your account
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Start managing your hosting services securely.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <Input
              label="Full name"
              name="full_name"
              placeholder="Your full name"
              value={values.full_name}
              autoComplete="name"
              required
              onChange={(event) => updateField("full_name", event.target.value)}
            />
            <FieldError message={getApiFieldError(fieldErrors, "full_name", ["fullName", "name"])} />
          </div>

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
              label="Phone number"
              name="phone"
              placeholder="+234..."
              value={values.phone}
              autoComplete="tel"
              onChange={(event) => updateField("phone", event.target.value)}
            />
            <FieldError message={getApiFieldError(fieldErrors, "phone", ["phone_number"])} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="Create password"
                value={values.password}
                autoComplete="new-password"
                required
                onChange={(event) => updateField("password", event.target.value)}
              />
              <FieldError message={getApiFieldError(fieldErrors, "password")} />
            </div>

            <div>
              <Input
                label="Confirm password"
                name="confirmPassword"
                type="password"
                placeholder="Repeat password"
                value={values.confirmPassword}
                autoComplete="new-password"
                required
                onChange={(event) => updateField("confirmPassword", event.target.value)}
              />
              <FieldError message={getApiFieldError(fieldErrors, "confirmPassword", ["re_password"])} />
            </div>
          </div>

          <ApiFormError message={error} fieldErrors={fieldErrors} />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <a href="/login" className="font-medium text-[#0064E0]">
              Login
            </a>
          </p>
        </form>
      </Card>
    </main>
  );
}