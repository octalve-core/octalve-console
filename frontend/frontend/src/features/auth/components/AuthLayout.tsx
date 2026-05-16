"use client";

import Link from "next/link";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import styles from "./AuthLayout.module.css";
import { cn } from "@/lib/utils";

type AuthLayoutProps = {
  title: string;
  description: string;
  sideTitle: string;
  sideDescription: string;
  icon: LucideIcon;
  children: ReactNode;
};

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: LucideIcon;
  error?: string;
};

type AuthPasswordInputProps = Omit<AuthInputProps, "type" | "icon">;

function AuthLogo() {
  const [failed, setFailed] = useState(false);

  return (
    <Link href="/login" aria-label="Octalve Console" className={styles.logoWrap}>
      {!failed ? (
        <span className={styles.logoBox}>
          <img
            src="/assets/logo/octalve.png"
            alt="Octalve"
            onError={() => setFailed(true)}
            className={styles.logo}
          />
        </span>
      ) : (
        <span className={styles.logoFallback}>
          <span className={styles.dotBlue} />
          <span className={styles.dotRed} />
          <span className={styles.dotOrange} />
          <span className={styles.dotGreen} />
        </span>
      )}
    </Link>
  );
}

export function AuthLayout({
  title,
  description,
  sideTitle,
  sideDescription,
  icon: Icon,
  children,
}: AuthLayoutProps) {
  return (
    <main className={styles.root}>
      <div className={styles.center}>
        <section className={styles.shell}>
          <aside className={styles.side}>
            <div>
              <AuthLogo />

              <div className={styles.sideContent}>
                <p className={styles.eyebrow}>Octalve Console</p>
                <h1 className={styles.sideTitle}>{sideTitle}</h1>
                <p className={styles.sideDescription}>{sideDescription}</p>
              </div>
            </div>

            <div className={styles.sideLine} />
          </aside>

          <section className={styles.formSide}>
            <div className={styles.formWrap}>
              <div className={styles.mobileLogo}>
                <AuthLogo />
              </div>

              <div className={styles.header}>
                <div className={styles.iconWrap}>
                  <Icon className="h-8 w-8" />
                </div>

                <h2 className={styles.title}>{title}</h2>
                <p className={styles.description}>{description}</p>
              </div>

              <div className={styles.body}>{children}</div>
            </div>
          </section>
        </section>
      </div>

      <footer className={styles.footer}>
        <span>© 2026 Octalve. All rights reserved.</span>
        <span>•</span>
        <Link href="https://octalve.cloud/privacy-policy">Privacy Policy</Link>
        <span>•</span>
        <Link href="https://octalve.cloud/terms-of-service">Terms of Service</Link>
      </footer>
    </main>
  );
}

export function AuthInput({ label, icon: Icon, error, className, ...props }: AuthInputProps) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={props.id ?? props.name} className={styles.label}>
        {label}
      </label>

      <div className={cn(styles.inputShell, error ? styles.inputShellError : "")}>
        {Icon ? <Icon className={styles.inputIcon} /> : null}

        <input
          {...props}
          id={props.id ?? props.name}
          className={cn(styles.input, className)}
        />
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

export function AuthPasswordInput({ label, error, className, ...props }: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={props.id ?? props.name} className={styles.label}>
        {label}
      </label>

      <div className={cn(styles.inputShell, error ? styles.inputShellError : "")}>
        <LockKeyhole className={styles.inputIcon} />

        <input
          {...props}
          id={props.id ?? props.name}
          type={visible ? "text" : "password"}
          className={cn(styles.input, className)}
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className={styles.eyeButton}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

export function AuthButton({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={disabled} className={styles.submitButton}>
      <span>{children}</span>
      <ArrowRight className="h-5 w-5" />
    </button>
  );
}

export const authFieldIcons = {
  mail: Mail,
  user: UserRound,
  phone: Phone,
};