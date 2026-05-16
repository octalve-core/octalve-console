"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
  Zap
} from "lucide-react";
import { getRoleDashboard, useAuth } from "@/context/AuthContext";

type TopbarProps = {
  area: "admin" | "client" | "staff";
  onMenuClick?: () => void;
};

function labelFromArea(area: "admin" | "client" | "staff") {
  return area.charAt(0).toUpperCase() + area.slice(1);
}

function getSettingsHref(role: "admin" | "client" | "staff") {
  if (role === "admin") return "/admin/settings";
  if (role === "client") return "/client/profile";
  return "/staff/security";
}

function getNotificationsHref(role: "admin" | "client" | "staff") {
  if (role === "admin") return "/admin/settings/notifications";
  if (role === "client") return "/client/support";
  return "/staff/tickets";
}

export function Topbar({ area, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [openMenu, setOpenMenu] = useState<"notifications" | "profile" | null>(null);

  const currentRole = user?.role ?? area;
  const areaLabel = labelFromArea(currentRole);

  const displayName = user?.name || `Octalve ${areaLabel}`;
  const displayEmail = user?.email || `${currentRole}@octalve.cloud`;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="oct-topbar">
      <div className="oct-topbar-left">
        <button
          type="button"
          className="oct-mobile-menu-button"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <div className="oct-topbar-search">
          <Search size={19} />
          <input placeholder="Search customers, invoices, domains..." />
          <span>⌘ K</span>
        </div>
      </div>

      <div className="oct-topbar-actions">
        <div className="oct-menu-wrap">
          <button
            type="button"
            className="oct-icon-btn"
            onClick={() => setOpenMenu(openMenu === "notifications" ? null : "notifications")}
            aria-label="Notifications"
          >
            <Bell size={19} />
            <span className="oct-notification-dot">3</span>
          </button>

          {openMenu === "notifications" ? (
            <div className="oct-dropdown oct-notification-menu">
              <div className="oct-dropdown-title">Notifications</div>

              <button
                type="button"
                className="oct-notification-item"
                onClick={() => router.push(getNotificationsHref(currentRole))}
              >
                <span className="oct-dot blue" />
                <div>
                  <strong>Notification center</strong>
                  <p>Review system, ticket, billing and provisioning alerts.</p>
                </div>
              </button>

              <button
                type="button"
                className="oct-notification-item"
                onClick={() => router.push(currentRole === "admin" ? "/admin/provisioning" : `/${currentRole}`)}
              >
                <span className="oct-dot green" />
                <div>
                  <strong>Provisioning status</strong>
                  <p>Hosting, domain and payment automation events appear here.</p>
                </div>
              </button>

              <button
                type="button"
                className="oct-dropdown-link"
                onClick={() => router.push(getNotificationsHref(currentRole))}
              >
                <Zap size={16} />
                View all notifications
              </button>
            </div>
          ) : null}
        </div>

        <div className="oct-menu-wrap">
          <button
            type="button"
            className="oct-profile-btn"
            onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
          >
            <span className="oct-avatar">
              <UserRound size={20} />
            </span>

            <span className="oct-profile-text">
              <strong>{displayName}</strong>
              <small>{areaLabel}</small>
            </span>

            <ChevronDown size={16} />
          </button>

          {openMenu === "profile" ? (
            <div className="oct-dropdown oct-profile-menu">
              <div className="oct-profile-card">
                <span className="oct-avatar large">
                  <UserRound size={22} />
                </span>

                <div>
                  <strong>{displayName}</strong>
                  <p>{displayEmail}</p>
                </div>
              </div>

              <button
                type="button"
                className="oct-dropdown-link"
                onClick={() => router.push(getRoleDashboard(currentRole))}
              >
                <UserRound size={16} />
                My dashboard
              </button>

              <button
                type="button"
                className="oct-dropdown-link"
                onClick={() => router.push(getSettingsHref(currentRole))}
              >
                <Settings size={16} />
                Account settings
              </button>

              <button
                type="button"
                className="oct-dropdown-link danger"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
