"use client";

import { MouseEvent as ReactMouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, LogOut, X, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ProductKey = "dashboard" | "expense" | "budget" | "journal" | "orbit" | "flow";

type MenuAction = {
  label: string;
  description?: string;
  href?: string;
  icon?: ReactNode;
  badge?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  external?: boolean;
};

export type AppUserMenuSection = {
  title?: string;
  items: MenuAction[];
};

type AppUserMenuProps = {
  product: ProductKey;
  displayName: string;
  avatarSrc?: string | null;
  sections?: AppUserMenuSection[];
  onSignOut?: () => void | Promise<void>;
  signOutLabel?: string;
  identityLabel?: string;
};

const PRODUCT_DESTINATIONS: Array<{
  product: Exclude<ProductKey, "dashboard">;
  label: string;
  href: string;
  icon: string;
}> = [
  {
    product: "expense",
    label: "Split",
    href: "/split",
    icon: "/brand/toodl-expense.svg",
  },
  {
    product: "budget",
    label: "Pulse",
    href: "/budget",
    icon: "/brand/toodl-budget.svg",
  },
  {
    product: "journal",
    label: "Story",
    href: "/journal",
    icon: "/brand/toodl-journal.svg",
  },
  {
    product: "orbit",
    label: "Orbit",
    href: "/orbit",
    icon: "/brand/toodl-orbit.svg",
  },
  {
    product: "flow",
    label: "Flow",
    href: "/flow",
    icon: "/brand/toodl-flow.svg",
  },
];

const DROPDOWN_CLASSES =
  "absolute right-0 top-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] transform overflow-visible rounded-3xl border border-slate-100 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur z-[80]";

export function AppUserMenu({
  product,
  displayName,
  avatarSrc,
  sections = [],
  onSignOut,
  signOutLabel = "Sign out",
  identityLabel = "Signed in as",
}: AppUserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const crossAppSection: AppUserMenuSection = useMemo(() => {
    const coreItems = PRODUCT_DESTINATIONS.map((destination) => ({
      label: destination.label,
      href: destination.href,
      icon: (
        <Image
          src={destination.icon}
          alt={destination.label}
          width={20}
          height={20}
          className="brand-logo h-5 w-5"
        />
      ),
      disabled: product === destination.product,
      badge: product === destination.product ? "Current" : undefined,
    }));

    const homeItem = {
      label: "Dashboard",
      href: "/dashboard",
      icon: (
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 text-white shadow-inner">
          <Home className="h-4 w-4" />
        </span>
      ),
      disabled: product === "dashboard",
      badge: product === "dashboard" ? "Current" : undefined,
    };

    return {
      title: "Jump to",
      items: [homeItem, ...coreItems],
    };
  }, [product]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handler = (event: MouseEvent) => {
      if (!dropdownRef.current) {
        return;
      }
      if (!dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const closeAll = () => {
    setMenuOpen(false);
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const body = document.body;
    const handleShift = () => {
      if (drawerOpen && window.innerWidth < 768) {
        body.classList.add("app-user-menu-open");
        body.style.overflow = "hidden";
      } else {
        body.classList.remove("app-user-menu-open");
        body.style.overflow = "";
      }
    };
    handleShift();
    window.addEventListener("resize", handleShift);
    return () => {
      body.classList.remove("app-user-menu-open");
      body.style.overflow = "";
      window.removeEventListener("resize", handleShift);
    };
  }, [drawerOpen]);

  const renderSection = (section: AppUserMenuSection, sectionIndex: number) => (
    <div key={`${section.title ?? "section"}-${sectionIndex}`} className="space-y-3">
      {section.title ? (
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
          {section.title}
        </p>
      ) : null}
      <div className="grid gap-2">
        {section.items.map((item, itemIndex) => {
          const content = (
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2 text-sm transition",
                item.disabled ? "cursor-not-allowed opacity-50" : "hover:border-slate-200 hover:bg-slate-50"
              )}
            >
              {item.icon ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100/60">
                  {item.icon}
                </span>
              ) : null}
              <div className="flex flex-1 flex-col text-left text-slate-700">
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className="text-xs text-slate-500">{item.description}</span>
                ) : null}
              </div>
              {item.badge ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {item.badge}
                </span>
              ) : null}
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={`${sectionIndex}-${itemIndex}-${item.label}`}
                href={item.href}
                onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
                  if (item.disabled) {
                    event.preventDefault();
                    return;
                  }
                  closeAll();
                  if (item.onClick) {
                    void item.onClick();
                  }
                }}
                className="block"
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={`${sectionIndex}-${itemIndex}-${item.label}`}
              type="button"
              onClick={() => {
                if (item.disabled) {
                  return;
                }
                closeAll();
                if (item.onClick) {
                  void item.onClick();
                }
              }}
              className="block w-full text-left"
              disabled={item.disabled}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );

  const menuSections = useMemo<AppUserMenuSection[]>(
    () => [crossAppSection, ...sections],
    [crossAppSection, sections]
  );

  const menuContent = (
    <div className="space-y-6">
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="flex flex-col gap-3 p-0">
          <CardTitle className="flex items-center gap-3 text-base font-semibold text-slate-900">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt="User avatar"
                width={48}
                height={48}
                className="h-12 w-12 rounded-full border border-slate-100 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-slate-400">{identityLabel}</span>
              <span className="text-sm font-semibold text-slate-900 truncate">{displayName}</span>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>
      <div className="space-y-6">
        {menuSections.map((section, index) => renderSection(section, index))}
      </div>
      {onSignOut ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
          <Button
            variant="outline"
            className="justify-start gap-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
            onClick={() => {
              closeAll();
              void onSignOut();
            }}
          >
            <LogOut className="h-4 w-4" />
            {signOutLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex w-full items-center gap-2 md:w-auto md:justify-end">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden -ml-1"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <button
        type="button"
        className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 md:flex"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
      >
        {avatarSrc ? (
          <Image
            src={avatarSrc}
            alt="User avatar"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full border border-slate-100 object-cover shadow"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-medium">{displayName}</span>
      </button>
      {menuOpen ? (
        <div ref={dropdownRef} className={DROPDOWN_CLASSES}>
          <div className="p-6">{menuContent}</div>
        </div>
      ) : null}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-none border-r border-slate-100 bg-white/95 px-6 backdrop-blur transition-all duration-300 data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full"
        >
          <SheetHeader className="flex flex-row items-center justify-between gap-4">
            <SheetTitle className="text-left text-base font-semibold text-slate-900">Menu</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </SheetHeader>
          <div className="mt-6 space-y-6">{menuContent}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
