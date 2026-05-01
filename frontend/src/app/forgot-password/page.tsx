import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset password" description="Enter your email address and the real backend will later send a secure password reset link.">
      <form className="grid">
        <label className="form-field"><span className="form-label">Email address</span><input className="input" type="email" placeholder="you@example.com" /></label>
        <Button>Send reset link</Button>
        <Button href="/login" variant="secondary">Back to login</Button>
      </form>
    </AuthShell>
  );
}
