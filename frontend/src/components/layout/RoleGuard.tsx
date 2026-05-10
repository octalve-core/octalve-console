"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingState } from "@/components/feedback/LoadingState";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/api/types";

type RoleGuardProps = {
  allowed: UserRole[];
  children: ReactNode;
};

export function RoleGuard({ allowed, children }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();

  const allowedKey = useMemo(() => allowed.join(","), [allowed]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
      return;
    }

    if (!allowed.includes(user.role)) {
      router.replace(getRoleDashboard(user.role));
    }
  }, [allowed, allowedKey, isAuthenticated, isLoading, pathname, router, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] p-6">
        <LoadingState
          title="Checking access"
          description="Please wait while we verify your console permissions."
        />
      </div>
    );
  }

  if (!user || !allowed.includes(user.role)) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] p-6">
        <LoadingState
          title="Redirecting"
          description="You are being redirected to the right workspace."
        />
      </div>
    );
  }

  return <>{children}</>;
}