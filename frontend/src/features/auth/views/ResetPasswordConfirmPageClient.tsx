"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { authApi } from "@/lib/api/endpoints";
import {
  getApiFieldError,
  parseApiValidationError,
  type ApiFieldErrors,
} from "@/lib/api/validation";
import { ApiFormError } from "@/components/feedback/ApiFormError";
import {
  AuthButton,
  AuthLayout,
  AuthPasswordInput,
} from "../components/AuthLayout";

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function ResetPasswordConfirmPageClient() {
  const params = useParams();
  const router = useRouter();

  const uid = safeDecode(getParamValue(params.uid));
  const token = safeDecode(getParamValue(params.token));

  // Decode the URL-encoded parameters
  // const uid = decodeURIComponent(params.uid as string);
  // const token = decodeURIComponent(params.token as string);

  // Now use these decoded values in your API call
  const [values, setValues] = useState({
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [success, setSuccess] = useState(false);
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

    if (!uid || !token) {
      setError("Invalid reset link. Please request a new password reset email.");
      return;
    }

    if (values.password !== values.confirmPassword) {
      setFieldErrors({
        confirmPassword: ["Passwords do not match."],
      });
      setError("Please correct the highlighted fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.confirmPasswordReset(uid, token, values.password);
      setSuccess(true);

      setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch (err) {
      const parsed = parseApiValidationError(
        err,
        "Unable to reset password. The link may be invalid or expired.",
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
      title="Create new password"
      description="Enter a new password for your Octalve Console account."
      sideTitle="Set a new secure password."
      sideDescription="Create a new password for your Octalve Console account using the secure reset link sent to your email."
    >
      {success ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-800">
          Password reset successful. Redirecting to login...
        </div>
      ) : (
        <form method="post" onSubmit={handleSubmit} className="grid gap-4 sm:gap-[18px]">
          <AuthPasswordInput
            label="New password"
            name="password"
            placeholder="Enter new password"
            value={values.password}
            autoComplete="new-password"
            required
            error={getApiFieldError(fieldErrors, "password", ["new_password"])}
            onChange={(event) => updateField("password", event.target.value)}
          />

          <AuthPasswordInput
            label="Confirm password"
            name="confirmPassword"
            placeholder="Repeat new password"
            value={values.confirmPassword}
            autoComplete="new-password"
            required
            error={getApiFieldError(fieldErrors, "confirmPassword", ["re_new_password"])}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
          />

          <ApiFormError message={error} fieldErrors={fieldErrors} />

          <div className="pt-2">
          <AuthButton disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Resetting...
              </span>
            ) : (
              "Reset password"
            )}
          </AuthButton>
          </div>

          <Link
            href="/login"
            className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-console-primary hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary"
          >
            Back to login
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
