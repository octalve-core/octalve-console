"use client";

import { AuthShell } from "../components/AuthShell";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

export function ForgotPasswordView() {
  return (
    <AuthShell
      title="Recover access"
      description="Enter your account email and the backend will send password reset instructions if the email exists."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
