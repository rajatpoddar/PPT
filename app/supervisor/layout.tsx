"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  ClipboardCheck,
  FileText,
  LogOut,
  HardHat,
  IndianRupee,
  TrendingUp,
  Package,
  MoreHorizontal,
  X,
} from "lucide-react";
import PushNotificationManager from "@/components/PushNotificationManager";

const navLinks = [
  { href: "/supervisor/execution", label: "Execution", icon: ClipboardCheck },
  { href: "/supervisor/dpr", label: "DPR", icon: FileText },
  { href: "/supervisor/payments", label: "Payments", icon: IndianRupee },
  { href: "/supervisor/expenses", label: "Expenses", icon: TrendingUp },
  { href: "/supervisor/inventory", label: "Inventory", icon: Package },
];

// First 4 links shown directly in mobile bottom bar, rest go in "More"
const MOBILE_VISIBLE = 4;
const mobileMainLinks = navLinks.slice(0, MOBILE_VISIBLE);
const mobileMoreLinks = navLinks.slice(MOBILE_VISIBLE);

/**
 * Supervisor layout shell — left sidebar on desktop, bottom tab bar on mobile.
 */
export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = mobileMoreLinks.some(
    ({ href }) => pathname === href || pathname.startsWith(href + "/")
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Desktop left sidebar ── */}
      <aside
        aria-label="Supervisor navigation"
        className="hidden sm:flex flex-col w-56 shrink-0 sticky top-0 h-screen border-r border-gray-200 bg-white shadow-sm"
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <HardHat className="h-5 w-5 text-orange-500" aria-hidden="true" />
          <span className="text-sm font-bold text-gray-900">PPT Builders</span>
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
            Supervisor
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-orange-500",
                  isActive
                    ? "bg-orange-50 text-orange-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: push notifications + sign out */}
        <div className="border-t border-gray-100 px-2 py-3 space-y-0.5">
          <div className="px-3 py-1">
            <PushNotificationManager />
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar — brand + push + logout */}
        <header className="sm:hidden sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 shadow-sm">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-orange-500" aria-hidden="true" />
            <span className="text-sm font-bold text-gray-900">PPT Builders</span>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
              Supervisor
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PushNotificationManager />
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
              className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 sm:pb-6 sm:px-6">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        aria-label="Supervisor mobile navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white sm:hidden"
      >
        <div className="flex">
          {mobileMainLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500",
                  isActive ? "text-orange-700" : "text-gray-500 hover:text-gray-900",
                ].join(" ")}
              >
                <Icon
                  className={["h-5 w-5", isActive ? "text-orange-500" : "text-gray-400"].join(" ")}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            );
          })}

          {/* More button — only shown if there are overflow links */}
          {mobileMoreLinks.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-label="More navigation options"
              className={[
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500",
                isMoreActive || moreOpen ? "text-orange-700" : "text-gray-500 hover:text-gray-900",
              ].join(" ")}
            >
              <MoreHorizontal
                className={["h-5 w-5", isMoreActive || moreOpen ? "text-orange-500" : "text-gray-400"].join(" ")}
                aria-hidden="true"
              />
              <span>More</span>
            </button>
          )}
        </div>

        {/* More drawer — slides up above the tab bar */}
        {moreOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bottom-16 bg-black/20 z-30"
              onClick={() => setMoreOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute bottom-full inset-x-0 z-40 bg-white border-t border-gray-200 shadow-lg rounded-t-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">More</span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close more menu"
                  className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 p-3">
                {mobileMoreLinks.map(({ href, label, icon: Icon }) => {
                  const isActive =
                    pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "flex items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-orange-500",
                        isActive
                          ? "bg-orange-50 text-orange-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </nav>
    </div>
  );
}
