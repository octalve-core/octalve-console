import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

type DashboardPageProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function DashboardPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: DashboardPageProps) {
  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
      />

      {children}
    </div>
  );
}