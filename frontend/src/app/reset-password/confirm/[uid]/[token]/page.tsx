"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

type ResetPasswordErrorPayload = {
  token?: string[] | string;
  uid?: string[] | string;
  new_password?: string[] | string;
  re_new_password?: string[] | string;
  password?: string[] | string;
  non_field_errors?: string[] | string;
  detail?: string;
  message?: string;
};

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function decodeResetValue(value: string) {
  if (!value) return "";

  let decoded = value;

  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep original value if decoding fails.
  }

  decoded = decoded.replace(/%3D/gi, "=");

  while (decoded.includes("%")) {
    try {
      const previous = decoded;
      decoded = decodeURIComponent(decoded);

      if (previous === decoded) break;
    } catch {
      break;
    }
  }

  return decoded.trim();
}

function errorText(value?: string[] | string) {
  if (!value) return "";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function getResetPasswordErrorMessage(
  payload: ResetPasswordErrorPayload,
  fallback: string,
) {
  if (payload.token) {
    return `Token error: ${errorText(payload.token)}. The reset link may have expired.`;
  }

  if (payload.uid) {
    return `User error: ${errorText(payload.uid)}`;
  }

  if (payload.new_password) {
    return `Password error: ${errorText(payload.new_password)}`;
  }

  if (payload.re_new_password) {
    return `Password confirmation error: ${errorText(payload.re_new_password)}`;
  }

  if (payload.password) {
    return `Password error: ${errorText(payload.password)}`;
  }

  if (payload.non_field_errors) {
    return errorText(payload.non_field_errors);
  }

  if (payload.detail) {
    return payload.detail;
  }

  if (payload.message) {
    return payload.message;
  }

  return fallback;
}

export default function ResetPasswordConfirmPage() {
  const params = useParams();
  const router = useRouter();

  const rawUid = getParamValue(params.uid);
  const rawToken = getParamValue(params.token);

  const uid = useMemo(() => decodeResetValue(rawUid), [rawUid]);
  const token = useMemo(() => decodeResetValue(rawToken), [rawToken]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordReady = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("=== RESET PASSWORD DEBUG ===");
      console.log("Raw UID:", rawUid);
      console.log("Decoded UID:", uid);
      console.log("Raw Token:", rawToken);
      console.log("Decoded Token:", token);
      console.log("Token length:", token.length);
      console.log("============================");
    }

    if (!uid || !token) {
      setError("Invalid reset link. Missing required parameters.");
    }

    setIsValidating(false);
  }, [rawUid, rawToken, uid, token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!uid || !token) {
      setError("Invalid reset link. Please request a new password reset link.");
      return;
    }

    if (!passwordReady) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.confirmPasswordReset(uid, token, password);

      setSuccess(true);

      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err) {
      console.error("Password reset error:", err);

      if (err instanceof ApiError && err.payload) {
        const payload = err.payload as ResetPasswordErrorPayload;

        if (process.env.NODE_ENV === "development") {
          console.error(
            "Full error payload:",
            JSON.stringify(payload, null, 2),
          );
        }

        setError(
          getResetPasswordErrorMessage(
            payload,
            err.message || "Failed to reset password.",
          ),
        );
      } else {
        setError("Unable to reset password. Please request a new reset link.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <main className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0064E0]" />
            <h1 className="mt-5 text-xl font-medium text-slate-950">
              Validating reset link
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Please wait while we confirm your password reset session.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <h1 className="mt-6 text-2xl font-medium tracking-[-0.03em] text-slate-950">
              Password reset successful
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your password has been updated. Redirecting you to login now.
            </p>

            <Link
              href="/login"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#0064E0] px-5 text-sm font-medium text-white transition hover:bg-[#0057C2]"
            >
              Go to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const linkIsInvalid = Boolean(error && !password);

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[78vh] max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#0064E0]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>

          <div className="mt-12 max-w-lg">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
              <ShieldCheck className="h-7 w-7" />
            </div>

            <h1 className="mt-8 text-5xl font-medium tracking-[-0.06em] text-slate-950">
              Secure your Octalve account.
            </h1>

            <p className="mt-5 text-base leading-8 text-slate-500">
              Create a new password to regain access to your hosting console,
              invoices, domains, services, and support workspace.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                Use at least 8 characters.
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                Avoid using a password you have used before.
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                Your reset link may expire for security reasons.
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                <LockKeyhole className="h-6 w-6" />
              </div>

              <h2 className="mt-6 text-3xl font-medium tracking-[-0.04em] text-slate-950">
                Reset password
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your new password below. Once saved, you can sign in
                again.
              </p>
            </div>

            {linkIsInvalid ? (
              <div>
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  <Link
                    href="/forgot-password"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-[#0064E0] px-5 text-sm font-medium text-white transition hover:bg-[#0057C2]"
                  >
                    Request new reset link
                  </Link>

                  <Link
                    href="/login"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Back to login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                  >
                    New password
                  </label>

                  <div className="mt-2 flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-[#0064E0] focus-within:ring-4 focus-within:ring-[#0064E0]/10">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={8}
                      placeholder="Enter new password"
                      className="h-full flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="text-slate-400 transition hover:text-slate-700"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="text-sm font-medium text-slate-700"
                  >
                    Confirm password
                  </label>

                  <div className="mt-2 flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-[#0064E0] focus-within:ring-4 focus-within:ring-[#0064E0]/10">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      required
                      minLength={8}
                      placeholder="Confirm new password"
                      className="h-full flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                      className="text-slate-400 transition hover:text-slate-700"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        passwordReady ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    Minimum of 8 characters
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        passwordsMatch ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    Passwords match
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
                    <div className="flex gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#0064E0] px-5 text-sm font-medium text-white transition hover:bg-[#0057C2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting password...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </button>

                <p className="text-center text-sm text-slate-500">
                  Remembered your password?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-[#0064E0] hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
