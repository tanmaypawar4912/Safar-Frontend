
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowUpRight,
  Activity,
  Boxes,
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Package,
  Settings,
  ShieldCheck,
  Star,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import LogiGoLogo from "../brand/LogiGoLogo";
import { useAuth } from "../../context/AuthContext";

type WorkspaceRole = "customer" | "driver" | "admin";

type SidebarItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  hint?: string;
};

const navigation: Record<WorkspaceRole, SidebarItem[]> = {
  customer: [
    { label: "Overview", to: "/customer", icon: LayoutDashboard },
    { label: "Book Delivery", to: "/customer/book", icon: Package, hint: "Create a shipment" },
    { label: "My Orders", to: "/customer/orders", icon: ClipboardList },
    { label: "My Profile", to: "/customer/profile", icon: UserRound },
    { label: "Reviews", to: "/customer/reviews", icon: Star },
    { label: "Complaints", to: "/customer/complaints", icon: MessageSquareWarning },
  ],
  driver: [
    { label: "Overview", to: "/driver", icon: LayoutDashboard },
    { label: "My Jobs", to: "/driver/jobs", icon: ClipboardList, hint: "Assigned deliveries" },
    { label: "My Profile", to: "/driver/profile", icon: UserRound },
    { label: "Completed", to: "/driver/completed", icon: Package },
    { label: "Earnings", to: "/driver/earnings", icon: CircleDollarSign },
    { label: "Reviews", to: "/driver/reviews", icon: Star },
    { label: "My Vehicles", to: "/driver/vehicles", icon: Truck },
    { label: "Documents", to: "/driver/documents", icon: FileText },
  ],
  admin: [
    { label: "Overview", to: "/admin", icon: LayoutDashboard },
    { label: "Bookings & dispatch", to: "/admin/bookings", icon: CalendarCheck },
    { label: "Customers", to: "/admin/customers", icon: Users },
    { label: "Drivers", to: "/admin/drivers", icon: Truck },
    { label: "Driver approvals", to: "/admin/driver-approvals", icon: ShieldCheck },
    { label: "Driver activity", to: "/admin/driver-activity", icon: Activity },
    { label: "Vehicle types", to: "/admin/vehicles", icon: Boxes },
    { label: "Pricing", to: "/admin/pricing", icon: CircleDollarSign },
    { label: "Payments", to: "/admin/payments", icon: CircleDollarSign, hint: "COD and online collections" },
    { label: "Business enquiries", to: "/admin/enterprise-enquiries", icon: Building2, hint: "Company requests" },
    { label: "Complaints", to: "/admin/complaints", icon: MessageSquareWarning },
    { label: "Reviews", to: "/admin/reviews", icon: Star },
    { label: "Settings", to: "/admin/settings", icon: Settings },
  ],
};

const workspaceText: Record<WorkspaceRole, { title: string; subtitle: string }> = {
  customer: { title: "Customer", subtitle: "Your deliveries, all together" },
  driver: { title: "Driver", subtitle: "Your routes. Your deliveries." },
  admin: { title: "Admin", subtitle: "Operations & platform control" },
};

const mobilePrimary: Record<WorkspaceRole, string[]> = {
  customer: ["/customer", "/customer/book", "/customer/orders"],
  driver: ["/driver", "/driver/jobs", "/driver/reviews"],
  admin: ["/admin", "/admin/bookings", "/admin/drivers"],
};

const mobileLabels: Record<WorkspaceRole, string[]> = {
  customer: ["Home", "Book", "Orders"],
  driver: ["Overview", "Jobs", "Reviews"],
  admin: ["Home", "Bookings", "Drivers"],
};

function isActiveItem(
  to: string,
  pathname: string,
  role: WorkspaceRole
) {
  const basePath = `/${role}`;

  if (to === basePath) return pathname === basePath;

  return pathname === to || pathname.startsWith(`${to}/`);
}

function initials(name?: string | null) {
  return (
    (name || "LogiGo User")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "LG"
  );
}

export default function DashboardLayout({
  role,
  children,
}: {
  role: WorkspaceRole;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const items = navigation[role];
  const workspace = workspaceText[role];

  const currentItem =
    [...items]
      .filter((item) => isActiveItem(item.to, location.pathname, role))
      .sort((a, b) => b.to.length - a.to.length)[0] ?? items[0];

  const displayName =
    user?.name ||
    (role === "driver"
      ? "Driver account"
      : role === "admin"
        ? "Administrator"
        : "Customer account");

  const roleLabel =
    role === "admin"
      ? "Administrator"
      : role === "driver"
        ? "Delivery partner"
        : "Customer";

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  function renderNavItem(item: SidebarItem) {
    const Icon = item.icon;
    const active = isActiveItem(item.to, location.pathname, role);

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setMobileMenuOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`lgs-link${active ? " is-active" : ""}`}
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    );
  }

  const avatar =
    user?.profileImage && !avatarFailed ? (
      <img
        src={user.profileImage}
        alt=""
        onError={() => setAvatarFailed(true)}
      />
    ) : (
      <span>{initials(user?.name)}</span>
    );

  return (
    <div
      className={`lg-workspace-shell lgs-shell${
        desktopSidebarExpanded
          ? " is-sidebar-expanded"
          : " is-sidebar-collapsed"
      }`}
    >
      <aside
        className="lgs"
        aria-label={`${workspace.title} sidebar`}
        onMouseEnter={() => setDesktopSidebarExpanded(true)}
        onMouseLeave={(event) => {
          const activeElement = document.activeElement;

          if (
            !(activeElement instanceof Node) ||
            !event.currentTarget.contains(activeElement)
          ) {
            setDesktopSidebarExpanded(false);
          }
        }}
        onFocusCapture={() => setDesktopSidebarExpanded(true)}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget;

          if (
            !(nextTarget instanceof Node) ||
            !event.currentTarget.contains(nextTarget)
          ) {
            setDesktopSidebarExpanded(false);
          }
        }}
      >
        <div className="lgs-brand">
          <LogiGoLogo to={`/${role}`} size="md" />
          <span className="lgs-role">{workspace.title}</span>
        </div>

        <nav
          className="lgs-nav"
          aria-label={`${workspace.title} navigation`}
        >
          {items.map((item) => renderNavItem(item))}
        </nav>

        <div className="lgs-foot">
          <Link to="/" className="lgs-link lgs-link-muted">
            <ArrowUpRight aria-hidden="true" />
            <span>Public site</span>
          </Link>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="lgs-link lgs-logout"
          >
            <LogOut aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="lg-workspace-main lgs-main">
        <header className="lgt">
          <div className="lgt-crumb" aria-label="Current page">
            <LogiGoLogo
              to={`/${role}`}
              tone="dark"
              size="sm"
              className="lgt-mobile-logo"
            />

            <span className="lgt-crumb-path">
              {workspace.title}
              <ChevronRight size={13} aria-hidden="true" />
              <strong>{currentItem?.label ?? workspace.title}</strong>
            </span>
          </div>

          <div className="lgt-user">
            <span className="lgt-user-copy">
              <strong>{displayName}</strong>
              <small>{roleLabel}</small>
            </span>

            <span className="lgt-avatar" title={user?.email || displayName}>
              {avatar}
            </span>
          </div>
        </header>

        <div className="lg-workspace-content lgs-content">
          {children}
        </div>
      </div>

      <nav
        className="lg-workspace-mobile-nav lgm"
        aria-label="Mobile workspace navigation"
      >
        <div className="lgm-grid">
          {mobilePrimary[role].map((to, index) => {
            const item =
              items.find((candidate) => candidate.to === to) ?? items[0];

            const Icon = item.icon;
            const active = isActiveItem(to, location.pathname, role);

            return (
              <Link
                key={to}
                to={to}
                className={`lgm-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{mobileLabels[role][index]}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={
              mobileMenuOpen ? "Close menu" : "Open more navigation"
            }
            className={`lgm-item${mobileMenuOpen ? " is-active" : ""}`}
          >
            {mobileMenuOpen ? (
              <X aria-hidden="true" />
            ) : (
              <Menu aria-hidden="true" />
            )}
            <span>More</span>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="lgm-backdrop"
          />

          <section
            className="lgm-sheet"
            aria-label="More workspace links"
          >
            <div className="lgm-sheet-head">
              <div>
                <p>{workspace.title} workspace</p>
                <small>{workspace.subtitle}</small>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <ChevronDown aria-hidden="true" />
              </button>
            </div>

            <div className="lgm-sheet-links">
              {items.map((item) => renderNavItem(item))}
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="lgs-link lgs-logout lgm-logout"
            >
              <LogOut aria-hidden="true" />
              <span>Logout</span>
            </button>
          </section>
        </>
      )}
    </div>
  );
}
