"use client";

import Link from "next/link";
import { Loader2, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { routes } from "@/lib/routes";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";
import { getAuthErrorMessage } from "../utils";

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await signup({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        referral_code: referralCode.trim() || undefined,
        password,
      });

      router.push(getRoleDashboard(session.user.role));
    } catch (err) {
      setError(getAuthErrorMessage(err, "Unable to create account. Please review your details and try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Full name"
        name="full_name"
        type="text"
        autoComplete="name"
        placeholder="Your full name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        leftIcon={<UserRound className="h-4 w-4" />}
        required
      />

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
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="Optional"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        leftIcon={<Phone className="h-4 w-4" />}
      />

      <Input
        label="Referral code"
        name="referral_code"
        type="text"
        placeholder="Optional"
        value={referralCode}
        onChange={(event) => setReferralCode(event.target.value)}
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="Minimum 8 characters"
        minLength={8}
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
            Creating account...
          </>
        ) : (
          "Create account"
        )}
      </Button>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href={routes.auth.login} className="font-medium text-[#0064E0] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
