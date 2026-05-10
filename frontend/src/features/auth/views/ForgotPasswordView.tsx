"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { authApi } from "@/lib/api/endpoints";
import { parseApiValidationError } from "@/lib/api/validation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiFormError } from "@/components/feedback/ApiFormError";

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setIsSubmitting(true);

    try {
      await authApi.requestPasswordReset(email.trim().toLowerCase());
      setNotice("If this email exists, a secure password reset link will be sent.");
    } catch (err) {
      const parsed = parseApiValidationError(
        err,
        "Unable to request password reset. Please try again.",
      );
      setError(parsed.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] px-4 py-10">
      <Card className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
            <MailCheck className="h-7 w-7" />
          </div>

          <h1 className="mt-6 text-3xl font-medium tracking-[-0.05em] text-slate-950">
            Reset password
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Enter your email address. If your account exists, you will receive a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Input
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            autoComplete="email"
            required
            onChange={(event) => setEmail(event.target.value)}
          />

          {notice ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
              {notice}
            </div>
          ) : null}

          <ApiFormError message={error} />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send reset link"
            )}
          </Button>

          <p className="text-center text-sm">
            <a href="/login" className="font-medium text-[#0064E0]">
              Back to login
            </a>
          </p>
        </form>
      </Card>
    </main>
  );
}