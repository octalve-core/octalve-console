"use client";

import Link from "next/link";
import {PrivilegedPasskeySetup} from "./PrivilegedPasskeySetup";
import { useEffect, useRef, useState } from "react";
import {ApiError} from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import styles from "../components/AuthLayout.module.css";
import {AuthSocialOptions} from "../components/AuthFormControls";
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

function getSafeNextPath() {
  if (typeof window === "undefined") return "";

  const searchParams = new URLSearchParams(window.location.search);
  const next = sanitizeNextPath(searchParams.get("next") ?? "");

  if (!next.startsWith("/") || next.startsWith("//")) return "";
  if (next.includes("://")) return "";

  return next;
}

const SENSITIVE_NEXT_QUERY_KEYS = new Set([
  "password",
  "new_password",
  "re_new_password",
  "re_password",
  "current_password",
  "token",
  "access",
  "refresh",
  "secret",
  "secret_key",
  "api_key",
]);

function sanitizeNextPath(value: string) {
  if (typeof window === "undefined") return "";

  const rawValue = value.trim();

  if (!rawValue) return "";
  if (!rawValue.startsWith("/")) return "";
  if (rawValue.startsWith("//")) return "";

  try {
    const url = new URL(rawValue, window.location.origin);

    if (url.origin !== window.location.origin) return "";

    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_NEXT_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    const safePath = `${url.pathname}${url.search}${url.hash}`;

    if (safePath === "/login" || safePath.startsWith("/login?")) return "";
    if (safePath === "/signup" || safePath.startsWith("/signup?")) return "";
    if (safePath === "/forgot-password" || safePath.startsWith("/forgot-password?")) return "";

    return safePath;
  } catch {
    return "";
  }
}

export function LoginPageClient() {
  const router = useRouter();
  const { login } = useAuth();

  const [nextPath, setNextPath] = useState("");
  const [passkeySetup,setPasskeySetup]=useState(false);
  const [passkeyQualification,setPasskeyQualification]=useState(false);
  const [values, setValues] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef=useRef(false);
  const [retryUntil,setRetryUntil]=useState(0);
  const [retrySeconds,setRetrySeconds]=useState(0);
  useEffect(()=>{
    if(!retryUntil)return;
    const tick=()=>setRetrySeconds(Math.max(0,Math.ceil((retryUntil-Date.now())/1000)));
    tick();
    const timer=window.setInterval(tick,1000);
    return ()=>window.clearInterval(timer);
  },[retryUntil]);

  useEffect(() => {
    setNextPath(getSafeNextPath());
    const mode=new URLSearchParams(window.location.search).get("passkey");
    setPasskeySetup(mode==="setup");
    setPasskeyQualification(mode==="verify");
  }, []);

  function updateField(name: keyof typeof values, value: string) {
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
    if(submittingRef.current||Date.now()<retryUntil)return;
    submittingRef.current=true;
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const session = await login({
        email: values.email,
        password: values.password,
        ...(passkeyQualification ? {passkey_qualification:true} : {}),
      });

      const role=session.user.role;
      const roleRoot=getRoleDashboard(role);
      const matchingRoute=nextPath===roleRoot||nextPath.startsWith(roleRoot+"/");
      const preserved=role==="client"?sanitizeCommerceNext(nextPath):"";
      router.replace(preserved||(matchingRoute?nextPath:roleRoot));
    } catch (err) {
      const parsed = parseApiValidationError(
        err,
        "Unable to login. Please check your details and try again.",
      );

      if(err instanceof ApiError&&err.status===429&&err.retryAfterSeconds){
        setRetrySeconds(err.retryAfterSeconds);
        setRetryUntil(Date.now()+err.retryAfterSeconds*1000);
        setError("Too many sign-in requests. Your account is protected by a temporary rate limit.");
      }else setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      submittingRef.current=false;
      setIsSubmitting(false);
    }
  }

  if(passkeySetup)return <PrivilegedPasskeySetup/>;

  return (
    <AuthLayout
      icon={LockKeyhole}
      title="Welcome back"
      description={passkeyQualification ? "Verify your enrolled privileged passkey." : "Sign in to continue to Octalve Console."}
      sideTitle="Manage your cloud services securely."
      sideDescription="Access your Octalve Console to manage hosting, domains, billing, orders, support, and services."
    >
      <form method="post" onSubmit={handleSubmit} className={styles.form}>
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

        <AuthPasswordInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={values.password}
          autoComplete="current-password"
          required
          error={getApiFieldError(fieldErrors, "password")}
          onChange={(event) => updateField("password", event.target.value)}
        />

        <div className={styles.options}>
          <span>Secure account sign-in</span>

          <Link href="/forgot-password" className={styles.link}>
            Forgot password?
          </Link>
        </div>

        <ApiFormError message={error} fieldErrors={fieldErrors} />
        {retrySeconds>0?<p className="text-sm text-console-muted" role="status">Try again in {Math.floor(retrySeconds/60)}:{String(retrySeconds%60).padStart(2,"0")}. No automatic retry.</p>:null}

        <div className="pt-2">
          <AuthButton disabled={isSubmitting||retrySeconds>0}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Logging in...
            </span>
          ) : (
            retrySeconds>0?"Please wait":"Sign in"
          )}
        </AuthButton>
        </div>

        <AuthSocialOptions/>
        <p className={styles.footer}>New to Octalve? <Link href={sanitizeCommerceNext(nextPath)?`/signup?next=${encodeURIComponent(sanitizeCommerceNext(nextPath))}`:"/signup"} className={styles.link}>Create account</Link></p>
      </form>
    </AuthLayout>
  );
}

