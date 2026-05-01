import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return <AuthShell title="Welcome back" description="Log in to manage your Octalve Cloud products, invoices, domains, support and infrastructure workspace."><LoginForm /></AuthShell>;
}
