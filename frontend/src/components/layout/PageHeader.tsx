import type { ReactNode } from "react";

export function PageHeader({ title, description, eyebrow = "Octalve Console", actions }: { title: string; description?: string; eyebrow?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
