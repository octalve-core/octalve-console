"use client";

import Link from "next/link";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { routes } from "@/lib/routes";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";
import { getAuthErrorMessage } from "../utils";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await login({
        email: email.trim(),
        password,
      });

      router.push(getRoleDashboard(session.user.role));
    } catch (err) {
      setError(getAuthErrorMessage(err, "Unable to sign in. Please check your details and try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        leftIcon={<Mail className="h-4 w-4" />}
        required
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        leftIcon={<LockKeyhole className="h-4 w-4" />}
        required
      />

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      <div className="flex flex-col gap-3 text-center text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <Link href={routes.auth.forgotPassword} className="font-medium text-[#0064E0] hover:underline">
          Forgot password?
        </Link>

        <Link href={routes.auth.signup} className="font-medium text-[#0064E0] hover:underline">
          Create account
        </Link>
      </div>
    </form>
  );
}
