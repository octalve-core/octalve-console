import type { ReactNode } from "react";

export function Card({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  return <section className={padded ? "card pad" : "card"}>{children}</section>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="card-header">
      <div>
        <h2 className="card-title">{title}</h2>
        {subtitle ? <div className="card-sub">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="card-body">{children}</div>;
}
