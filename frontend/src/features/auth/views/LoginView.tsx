"use client";

import { AuthShell } from "../components/AuthShell";
import { LoginForm } from "../components/LoginForm";

export function LoginView() {
  return (
    <AuthShell
      title="Sign in"
      description="Access your Octalve hosting console, services, billing, domains, support, and admin workspace."
    >
      <LoginForm />
    </AuthShell>
  );
}
