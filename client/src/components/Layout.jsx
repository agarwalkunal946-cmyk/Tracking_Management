import {
  Activity,
  BarChart3,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Settings,
  Truck,
  UserRoundCog,
  UsersRound,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { shortName } from "../utils";
const primaryItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/deliveries/new", label: "New delivery", icon: PackagePlus },
  { to: "/deliveries", label: "Delivery history", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: BarChart3 }
];
const adminItems = [
  { to: "/clients", label: "Clients", icon: UsersRound },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/staff", label: "Staff", icon: UserRoundCog },
  { to: "/activity", label: "Activity log", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings }
];
const titles = {
  "/": { eyebrow: "Command center", title: "Good day, here\u2019s your fleet." },
  "/deliveries/new": { eyebrow: "Quick entry", title: "Log a new delivery" },
  "/deliveries": { eyebrow: "Operations", title: "Delivery history" },
  "/reports": { eyebrow: "Insights", title: "Reports & summaries" },
  "/clients": { eyebrow: "Directory", title: "Client management" },
  "/vehicles": { eyebrow: "Fleet", title: "Vehicle management" },
  "/staff": { eyebrow: "Team access", title: "Staff management" },
  "/activity": { eyebrow: "Security", title: "Activity log" },
  "/settings": { eyebrow: "Workspace", title: "System settings" }
};
function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const page = titles[location.pathname] ?? titles["/"];
  const items = user?.role === "ADMIN" ? [...primaryItems, ...adminItems] : primaryItems;
  const nav = <>
      <div className="brand">
        <div className="brand-mark"><Truck size={21} strokeWidth={2.4} /></div>
        <div>
          <strong>RouteFlow</strong>
          <span>Delivery intelligence</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-label">Workspace</p>
        {primaryItems.map((item) => <NavItem key={item.to} {...item} close={() => setMobileOpen(false)} />)}
        {user?.role === "ADMIN" && <>
            <p className="nav-label nav-label-spaced">Administration</p>
            {adminItems.map((item) => <NavItem key={item.to} {...item} close={() => setMobileOpen(false)} />)}
          </>}
      </nav>

      <div className="sidebar-foot">
        <div className="secure-card">
          <span className="secure-dot" />
          <div><strong>Secure workspace</strong><small>Role-based access enabled</small></div>
        </div>
      </div>
    </>;
  return <div className="app-shell">
      <aside className="sidebar">{nav}</aside>
      <AnimatePresence>
        {mobileOpen && <>
            <motion.div
    className="mobile-overlay"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={() => setMobileOpen(false)}
  />
            <motion.aside
    className="mobile-sidebar"
    initial={{ x: "-100%" }}
    animate={{ x: 0 }}
    exit={{ x: "-100%" }}
    transition={{ type: "spring", damping: 28, stiffness: 300 }}
  >
              <button className="mobile-close" onClick={() => setMobileOpen(false)}><X /></button>
              {nav}
            </motion.aside>
          </>}
      </AnimatePresence>

      <main className="main-area">
        <header className="topbar">
          <div className="page-heading">
            <button className="menu-button" onClick={() => setMobileOpen(true)}><Menu /></button>
            <div>
              <span>{page.eyebrow}</span>
              <h1>{page.title}</h1>
            </div>
          </div>
          <div className="profile-wrap">
            <button className="profile-button" onClick={() => setProfileOpen((value) => !value)}>
              <span className="avatar">{shortName(user?.name ?? "User")}</span>
              <span className="profile-copy"><strong>{user?.name}</strong><small>{user?.role === "ADMIN" ? "Administrator" : "Staff user"}</small></span>
              <ChevronDown size={16} />
            </button>
            <AnimatePresence>
              {profileOpen && <motion.div
    className="profile-menu"
    initial={{ opacity: 0, y: -8, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -8, scale: 0.97 }}
  >
                  <p>{user?.email}</p>
                  <button onClick={() => void logout()}><LogOut size={16} /> Sign out</button>
                </motion.div>}
            </AnimatePresence>
          </div>
        </header>

        <motion.div
    className="page-content"
    key={location.pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28 }}
  >
          <Outlet />
        </motion.div>
      </main>

      <nav className="mobile-dock">
        {items.slice(0, 4).map((item) => {
    const Icon = item.icon;
    return <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              <Icon size={20} />
              <span>{item.label.replace("Delivery ", "")}</span>
            </NavLink>;
  })}
        <button onClick={() => setMobileOpen(true)}><Menu size={20} /><span>More</span></button>
      </nav>
    </div>;
}
function NavItem({ to, label, icon: Icon, close }) {
  return <NavLink to={to} end={to === "/"} onClick={close} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
      <Icon size={19} />
      <span>{label}</span>
      <i />
    </NavLink>;
}
export {
  Layout
};
