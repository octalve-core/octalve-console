"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone, UserRound, UserRoundPlus } from "lucide-react";
import styles from "../components/AuthLayout.module.css";
import {AuthPasswordStrength,AuthSocialOptions} from "../components/AuthFormControls";
import { ApiFormError } from "@/components/feedback/ApiFormError";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";
import {
  getApiFieldError,
  parseApiValidationError,
  type ApiFieldErrors,
} from "@/lib/api/validation";
import {
  AuthButton,
  AuthInput,
  AuthLayout,
  AuthPasswordInput,
} from "../components/AuthLayout";

export function SignupPageClient() {
  const router = useRouter();
  const { signup } = useAuth();

  const [values, setValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referralCode,setReferralCode]=useState<string|null>(null);
  const [referralConsent,setReferralConsent]=useState(false);
  useEffect(()=>{
    const value=new URLSearchParams(window.location.search).get("ref")||"";
    setReferralCode(/^[A-Z0-9]{10}$/.test(value)?value:null);
  },[]);

  function updateField(name: keyof typeof values, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));

    if (fieldErrors[String(name)]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[String(name)];
        return next;
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    if (values.password !== values.confirmPassword) {
      setFieldErrors({
        confirmPassword: ["Passwords do not match."],
      });
      setError("Please correct the highlighted fields.");
      return;
    }

    if (!values.acceptedTerms) {
      setError("You must agree to the terms before creating an account.");
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await signup({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        // Explicit link attribution only: no tracking cookie or background profile.
        referral_code: referralConsent?referralCode||undefined:undefined,
      });

      router.replace(getRoleDashboard(session.user.role));
    } catch (err) {
      const parsed = parseApiValidationError(
        err,
        "Unable to create account. Please check the form and try again.",
      );

      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      icon={UserRoundPlus}
      title="Create account"
      description="Start managing your hosting services securely."
      sideTitle="Create your Octalve Cloud workspace."
      sideDescription="Create an account to access hosting services, domains, invoices, orders, support tickets, and secure account management."
    >
      <form method="post" onSubmit={handleSubmit} className={styles.form}>
        <AuthInput
          label="Full name"
          name="full_name"
          icon={UserRound}
          placeholder="Your full name"
          value={values.full_name}
          autoComplete="name"
          required
          error={getApiFieldError(fieldErrors, "full_name", ["fullName", "name"])}
          onChange={(event) => setValues((current) => ({ ...current, full_name: event.target.value }))}
        />

        <AuthInput
          label="Email address"
          name="email"
          type="email"
          icon={Mail}
          placeholder="you@example.com"
          value={values.email}
          autoComplete="email"
          required
          error={getApiFieldError(fieldErrors, "email")}
          onChange={(event) => updateField("email", event.target.value)}
        />

        <AuthInput
          label="Phone number"
          name="phone"
          icon={Phone}
          placeholder="+234..."
          value={values.phone}
          autoComplete="tel"
          error={getApiFieldError(fieldErrors, "phone", ["phone_number"])}
          onChange={(event) => updateField("phone", event.target.value)}
        />

        <div className={styles.twoFields}>
          <AuthPasswordInput
            label="Password"
            name="password"
            placeholder="Create password"
            value={values.password}
            autoComplete="new-password"
            required
            error={getApiFieldError(fieldErrors, "password")}
            onChange={(event) => updateField("password", event.target.value)}
          />

          <AuthPasswordInput
            label="Confirm password"
            name="confirmPassword"
            placeholder="Repeat password"
            value={values.confirmPassword}
            autoComplete="new-password"
            required
            error={getApiFieldError(fieldErrors, "confirmPassword", ["re_password"])}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
          />
        </div>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={values.acceptedTerms}
            onChange={(event) => updateField("acceptedTerms", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#0064E0]"
          />
          <span>
            I agree to the{" "}
            <a href="https://cloud.octalve.com/terms-of-service" className={styles.link}>
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="https://cloud.octalve.com/privacy-policy" className={styles.link}>
              Privacy Policy
            </a>
          </span>
        </label>

        {referralCode?<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
          <input type="checkbox" checked={referralConsent}
            onChange={event=>setReferralConsent(event.target.checked)}
            className="mt-1 h-4 w-4 accent-blue-600"/>
          <span>This signup link contains an affiliate referral code.
            Allow your registration to be attributed to the person who shared it.
            This is optional and does not change your account price.
            No referral attribution is sent if you leave this unchecked.</span>
        </label>:null}

        <AuthPasswordStrength password={values.password}/>
        <ApiFormError message={error} fieldErrors={fieldErrors} />

        <div className="pt-2">
          <AuthButton disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </span>
          ) : (
            "Create account"
          )}
        </AuthButton>
        </div>

        <AuthSocialOptions/>
        <p className={styles.footer}>Already have an account? <Link href="/login" className={styles.link}>Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}
