"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {PHONE_COUNTRIES,suggestPhoneCountry} from "../lib/country-dial-codes";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone, UserRound, UserRoundPlus } from "lucide-react";
import styles from "../components/AuthLayout.module.css";
import {AuthPasswordStrength,AuthSocialOptions} from "../components/AuthFormControls";
import { ApiFormError } from "@/components/feedback/ApiFormError";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";
import {sanitizeCommerceNext} from "@/lib/commerce/sanitize-commerce-next";
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
    username: "",
    phone_country: "NG",
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
  const [commerceNext,setCommerceNext]=useState("");
  useEffect(()=>{
    const value=new URLSearchParams(window.location.search).get("ref")||"";
    setReferralCode(/^[A-Z0-9]{10}$/.test(value)?value:null);
    setCommerceNext(sanitizeCommerceNext(new URLSearchParams(window.location.search).get("next")));
    const intl=Intl.DateTimeFormat().resolvedOptions();
    setValues(current=>({...current,phone_country:suggestPhoneCountry(navigator.language,intl.timeZone||"")}));
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

    const selected=PHONE_COUNTRIES.find(country=>country.iso===values.phone_country);
    const typed=values.phone.trim().replace(/[\s().-]/g,"");
    // '+' means user entered a complete international number. Country selection
    // only prefixes national digits, never overrides an explicitly chosen code.
    const domestic=typed.replace(/[^0-9]/g,"");
    const prefix=selected?.dial||"+234";
    const internationalPhone=typed.startsWith("+")
      ? typed
      : typed ? prefix+((["NG","GB"].includes(values.phone_country))?domestic.replace(/^0/,""):domestic) : "";
    if(internationalPhone&&!/^\+[1-9][0-9]{7,14}$/.test(internationalPhone)){
      setFieldErrors({phone:["Enter a valid international number including country code."]});
      return;
    }
    if(values.username.trim()&&!/^[a-z][a-z0-9_]{2,29}$/.test(values.username.trim().toLowerCase())){
      setFieldErrors({username:["Start with a letter; use 3–30 letters, numbers or underscores."]});
      return;
    }
    if(values.email.trim()!==values.email||!/^\S+@\S+\.\S+$/.test(values.email.trim())){
      setFieldErrors({email:["Enter a valid email address."]});
      return;
    }
    setIsSubmitting(true);

    try {
      const session = await signup({
        full_name: values.full_name,
        email: values.email.trim().toLowerCase(),
        username: values.username.trim().toLowerCase()||undefined,
        accepted_terms_version: "2026-10-30",
        phone: internationalPhone,
        password: values.password,
        // Explicit link attribution only: no tracking cookie or background profile.
        referral_code: referralConsent?referralCode||undefined:undefined,
      });

      router.replace(session.user.role==="client" ? (commerceNext||getRoleDashboard(session.user.role)) : getRoleDashboard(session.user.role));
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
          label="Username (optional)"
          name="username"
          icon={UserRound}
          placeholder="Choose a unique username"
          value={values.username}
          maxLength={30}
          autoComplete="username"
          error={getApiFieldError(fieldErrors, "username")}
          onChange={(event) => updateField("username", event.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="min-w-0">
            <label htmlFor="phone-country" className={styles.fieldLabel}>Country calling code</label>
            <select id="phone-country" name="phone_country" value={values.phone_country}
              onChange={event=>updateField("phone_country",event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus-visible:outline-2 focus-visible:outline-console-primary">
              {PHONE_COUNTRIES.map(country=><option key={country.iso} value={country.iso}>
                {country.name} ({country.dial})
              </option>)}
            </select>
          </div>
          <AuthInput
            label="Phone number (optional)"
            name="phone"
            type="tel"
            icon={Phone}
            placeholder="National number"
            value={values.phone}
            autoComplete="tel-national"
            inputMode="tel"
            error={getApiFieldError(fieldErrors, "phone", ["phone_number"])}
            onChange={(event) => updateField("phone", event.target.value)}
          />
        </div>
        <p className="-mt-2 text-xs text-slate-500">Country is suggested from your browser language and time zone; you can change it. Your number is not verified until an approved OTP service confirms it.</p>

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

        <AuthPasswordStrength password={values.password}/>

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
        <p className={styles.footer}>Already have an account? <Link href={commerceNext?`/login?next=${encodeURIComponent(commerceNext)}`:"/login"} className={styles.link}>Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}
