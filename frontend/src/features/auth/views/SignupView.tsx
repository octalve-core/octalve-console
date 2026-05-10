"use client";

import { AuthShell } from "../components/AuthShell";
import { SignupForm } from "../components/SignupForm";

export function SignupView() {
  return (
    <AuthShell
      title="Create account"
      description="Create your Octalve Console account to order services, manage domains, pay invoices, and open support tickets."
    >
      <SignupForm />
    </AuthShell>
  );
}
