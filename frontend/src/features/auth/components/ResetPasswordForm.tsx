"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { routes } from "@/lib/routes";
import { authApiV2 } from "@/lib/api/modules/auth.api";
import { getAuthErrorMessage } from "../utils";

type ResetPasswordFormProps = {
  uid: string;
  token: string;
};

export function ResetPasswordForm({ uid, token }: ResetPasswordFormProps) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const passwordReady = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
      await authApiV2.confirmPasswordReset(uid, token, password);
      setSuccess(true);

      setTimeout(() => {
        router.push(routes.auth.login);
      }, 2500);
    } catch (err) {
      setError(getAuthErrorMessage(err, "Unable to reset password. Please request a new reset link."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-700">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-emerald-900">Password reset successful</h3>
              <p className="mt-1 text-sm leading-6">Your password has been updated. Redirecting to login.</p>
            </div>
          </div>
        </div>

        <Button href={routes.auth.login} size="lg" className="mt-6 w-full">
          Go to login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="New password"
        name="new_password"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        placeholder="Minimum 8 characters"
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="text-slate-400 transition hover:text-slate-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        required
      />

      <Input
        label="Confirm password"
        name="re_new_password"
        type={showConfirmPassword ? "text" : "password"}
        autoComplete="new-password"
        placeholder="Confirm new password"
        minLength={8}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowConfirmPassword((current) => !current)}
            className="text-slate-400 transition hover:text-slate-700"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        required
      />

      <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${passwordReady ? "bg-emerald-500" : "bg-slate-300"}`} />
          Minimum of 8 characters
        </div>

        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${passwordsMatch ? "bg-emerald-500" : "bg-slate-300"}`} />
          Passwords match
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Resetting password...
          </>
        ) : (
          "Reset password"
        )}
      </Button>

      <p className="text-center text-sm text-slate-500">
        Remembered your password?{" "}
        <Link href={routes.auth.login} className="font-medium text-[#0064E0] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
