import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return <AuthShell title="Create your account" description="Start managing hosting, domains, SSL, email, billing, wallet and support from one premium console."><SignupForm /></AuthShell>;
}
