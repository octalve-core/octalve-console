import { Bell, Search, UserRound } from "lucide-react";

export function Topbar({ area }: { area: "Admin" | "Client" | "Staff" }) {
  return (
    <header className="topbar">
      <div className="search-box"><Search size={18} /> <span>Smart search customers, invoices, domains...</span></div>
      <div className="topbar-right">
        <button className="icon-button" type="button"><Bell size={18} /></button>
        <div className="user-chip">
          <div className="avatar"><UserRound size={18} /></div>
          <div><div>Octalve {area}</div><div style={{ color: "#64748b", fontSize: 12 }}>{area}</div></div>
        </div>
      </div>
    </header>
  );
}
