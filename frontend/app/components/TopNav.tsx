"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type NavGroup = {
  label: string;
  icon: string;
  items: NavItem[];
};

// Regroupement par catégorie plutôt qu'une pile de boutons à plat : on
// ajoute une page à un groupe existant, on ne rallonge plus la barre.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Candidatures",
    icon: "📁",
    items: [
      { href: "/", label: "Liste", icon: "📋" },
      { href: "/kanban", label: "Kanban", icon: "📌" },
      { href: "/duplicates", label: "Doublons", icon: "🧹" },
    ],
  },
  {
    label: "Prospection",
    icon: "🎯",
    items: [
      { href: "/spontaneous", label: "Candidature spontanée", icon: "🎯" },
    ],
  },
  {
    label: "Suivi",
    icon: "🔔",
    items: [
      { href: "/reminders", label: "Rappels", icon: "🔔" },
      { href: "/emails", label: "Journal des emails", icon: "📧" },
      { href: "/stats", label: "Statistiques", icon: "📊" },
    ],
  },
];

const PROFILE_ITEM: NavItem = {
  href: "/profile",
  label: "Mon profil",
  icon: "👤",
};

export default function TopNav() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Ferme le menu ouvert au clic en dehors de la barre.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Referme tout menu quand on change de page.
  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function isGroupActive(group: NavGroup) {
    return group.items.some((item) => isActive(item.href));
  }

  const itemClass = (active: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
      active
        ? "bg-blue-50 font-semibold text-blue-700"
        : "text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 md:px-6">
        <Link href="/" className="shrink-0 text-base font-bold text-slate-900">
          JobTracker <span className="text-blue-600">AI</span>
        </Link>

        {/* Barre catégorisée — desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenGroup((current) =>
                    current === group.label ? null : group.label
                  )
                }
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isGroupActive(group) || openGroup === group.label
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{group.icon}</span>
                {group.label}
                <span className="text-[10px] text-slate-400">
                  {openGroup === group.label ? "▲" : "▼"}
                </span>
              </button>

              {openGroup === group.label && (
                <div className="absolute left-0 top-full z-40 mt-1 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={itemClass(isActive(item.href))}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          <Link
            href={PROFILE_ITEM.href}
            className={`ml-1 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive(PROFILE_ITEM.href)
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>{PROFILE_ITEM.icon}</span>
            {PROFILE_ITEM.label}
          </Link>
        </div>

        {/* Bouton menu — mobile */}
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 md:hidden"
        >
          {mobileOpen ? "✕ Fermer" : "☰ Menu"}
        </button>
      </div>

      {/* Menu déplié — mobile */}
      {mobileOpen && (
        <div className="space-y-4 border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-1 text-xs font-semibold text-slate-400">
                {group.icon} {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={itemClass(isActive(item.href))}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div>
            <p className="mb-1.5 px-1 text-xs font-semibold text-slate-400">
              👤 Compte
            </p>
            <Link
              href={PROFILE_ITEM.href}
              className={itemClass(isActive(PROFILE_ITEM.href))}
            >
              <span>{PROFILE_ITEM.icon}</span>
              {PROFILE_ITEM.label}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
