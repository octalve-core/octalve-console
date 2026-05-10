"use client";

import Link from "next/link";
import { AlertCircle , LockKeyhole} from "lucide-react";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { routes } from "@/lib/routes";
import { AuthShell } from "../components/AuthShell";
import { ResetPasswordForm } from "../components/ResetPasswordForm";
import { decodeResetValue, getParamValue } from "../utils";

export function ResetPasswordConfirmView() {
  const params = useParams();

  const rawUid = getParamValue(params.uid);
  const rawToken = getParamValue(params.token);

  const uid = useMemo(() => decodeResetValue(rawUid), [rawUid]);
  const token = useMemo(() => decodeResetValue(rawToken), [rawToken]);

  const invalidLink = !uid || !token;

  return (
    <AuthShell
      icon={LockKeyhole}
      title="Reset password"
      description="Create a new secure password for your Octalve Console account."
    >
      {invalidLink ? (
        <div>
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-950">Invalid reset link</h3>
                <p className="mt-1 text-sm leading-6">
                  The reset link is missing required verification details. Please request a new link.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <Button href={routes.auth.forgotPassword} size="lg" className="w-full">
              Request new reset link
            </Button>

            <Link href={routes.auth.login} className="text-center text-sm font-medium text-[#0064E0] hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      ) : (
        <ResetPasswordForm uid={uid} token={token} />
      )}
    </AuthShell>
  );
}
