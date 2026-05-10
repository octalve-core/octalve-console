"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  sideTitle?: string;
  sideDescription?: string;
  sideFooter?: string;
};

type AuthInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: LucideIcon;
  error?: string;
};

type AuthPasswordInputProps = Omit<AuthInputProps, "type" | "icon">;

function OctalveLogo({ light = false }: { light?: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <Link href="/login" className="oct-auth-logo" aria-label="Octalve Console">
      {!failed ? (
        <img
          src="/assets/logo/octalve.png"
          alt="Octalve"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={cn(
            "grid h-10 w-10 grid-cols-2 gap-1 rounded-2xl p-2",
            light ? "bg-white" : "bg-[#061330]",
          )}
        >
          <span className="rounded-full bg-[#0064E0]" />
          <span className="rounded-full bg-[#E61525]" />
          <span className="rounded-full bg-[#FC7E24]" />
          <span className="rounded-full bg-[#29BE3E]" />
        </div>
      )}
    </Link>
  );
}

export function AuthShell({
  title,
  description,
  icon: Icon,
  children,
  sideTitle = "Manage your cloud services securely.",
  sideDescription = "Access your Octalve Cloud workspace for hosting, domains, billing, orders, support, and service management.",
  sideFooter = "Only authorized users should access this console. All activity is protected by secure authentication and role-based permissions.",
}: AuthShellProps) {
  return (
    <main className="oct-auth-page">
      <div className="oct-auth-center">
        <section className="oct-auth-card">
          <aside className="oct-auth-side">
            <div className="oct-auth-side-inner">
              <OctalveLogo light />

              <p className="oct-auth-side-eyebrow">Octalve Console</p>
              <h1 className="oct-auth-side-title">{sideTitle}</h1>
              <p className="oct-auth-side-description">{sideDescription}</p>

              <div className="oct-auth-points">
                {[
                  "Role-based access for clients, staff, and administrators.",
                  "Manage hosting, domains, invoices, orders, and support.",
                  "Connected to Octalve Cloud backend services.",
                ].map((item) => (
                  <div key={item} className="oct-auth-point">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#7DB7FF]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="oct-auth-security">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#7DB7FF]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p>{sideFooter}</p>
              </div>
            </div>
          </aside>

          <section className="oct-auth-form-side">
            <div className="oct-auth-form-wrap">
              <div className="oct-auth-mobile-logo">
                <OctalveLogo />
              </div>

              <div className="text-center">
                <div className="oct-auth-icon">
                  <Icon className="h-8 w-8" />
                </div>

                <h2 className="oct-auth-heading">{title}</h2>
                <p className="oct-auth-subtitle">{description}</p>
              </div>

              <div className="oct-auth-body">{children}</div>
            </div>
          </section>
        </section>
      </div>

      <footer className="oct-auth-footer">
        <span>© 2026 Octalve. All rights reserved.</span>
        <span>•</span>
        <Link href="https://octalve.cloud/privacy-policy" className="font-medium text-[#0064E0]">
          Privacy Policy
        </Link>
        <span>•</span>
        <Link href="https://octalve.cloud/terms-of-service" className="font-medium text-[#0064E0]">
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}

export function AuthInput({ label, icon: Icon, error, className, ...props }: AuthInputProps) {
  return (
    <div>
      <label htmlFor={props.id ?? props.name} className="mb-2 block text-sm font-semibold text-[#061330]">
        {label}
      </label>

      <div
        className={cn(
          "flex h-14 items-center gap-3 rounded-2xl border bg-white px-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition focus-within:border-[#0064E0] focus-within:ring-4 focus-within:ring-[#0064E0]/10",
          error ? "border-red-300" : "border-[#D7E3F2]",
        )}
      >
        {Icon ? <Icon className="h-5 w-5 shrink-0 text-slate-400" /> : null}

        <input
          {...props}
          id={props.id ?? props.name}
          className={cn(
            "h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-[#061330] outline-none placeholder:text-slate-400",
            className,
          )}
        />
      </div>

      {error ? <p className="mt-2 text-xs font-medium leading-5 text-red-600">{error}</p> : null}
    </div>
  );
}

export function AuthPasswordInput({ label, error, className, ...props }: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={props.id ?? props.name} className="mb-2 block text-sm font-semibold text-[#061330]">
        {label}
      </label>

      <div
        className={cn(
          "flex h-14 items-center gap-3 rounded-2xl border bg-white px-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition focus-within:border-[#0064E0] focus-within:ring-4 focus-within:ring-[#0064E0]/10",
          error ? "border-red-300" : "border-[#D7E3F2]",
        )}
      >
        <LockKeyhole className="h-5 w-5 shrink-0 text-slate-400" />

        <input
          {...props}
          id={props.id ?? props.name}
          type={visible ? "text" : "password"}
          className={cn(
            "h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-[#061330] outline-none placeholder:text-slate-400",
            className,
          )}
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-[#0064E0]"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs font-medium leading-5 text-red-600">{error}</p> : null}
    </div>
  );
}

export function AuthSubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#0064E0] px-5 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(0,100,224,0.25)] transition hover:bg-[#0057C2] disabled:cursor-not-allowed disabled:opacity-65"
    >
      <span>{children}</span>
      <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
    </button>
  );
}

export const authIcons = {
  mail: Mail,
  user: UserRound,
  phone: Phone,
};