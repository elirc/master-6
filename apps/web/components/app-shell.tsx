"use client";

import Link from "next/link";
import { Award, BarChart3, BookOpen, ClipboardCheck, GraduationCap, KeyRound, LayoutDashboard, Settings, Users } from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/catalog", icon: BookOpen, label: "Catalog" },
  { href: "/course/course-security", icon: GraduationCap, label: "Course" },
  { href: "/instructor", icon: ClipboardCheck, label: "Instructor" },
  { href: "/admin", icon: Users, label: "Admin" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/certificates/verify/CERT-DEMO2026", icon: Award, label: "Verify" },
  { href: "/login", icon: KeyRound, label: "Login" },
  { href: "/settings", icon: Settings, label: "Settings" }
];

export function AppShell({ children, title = "Northwind LearnOps" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>{title}</span>
        </div>
        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="nav-item" href={item.href} key={item.href}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <div>
            <strong>Northwind Learning</strong>
            <div className="muted">Enterprise training operations</div>
          </div>
          <div className="toolbar">
            <span className="status blue">Org Admin</span>
            <span className="status green">Healthy</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
