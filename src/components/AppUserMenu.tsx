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
  dark?: boolean;
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

const getDropdownClasses = (dark: boolean) =>
  dark
    ? "absolute right-0 top-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] transform overflow-visible rounded-3xl border border-white/20 bg-slate-900/95 text-white shadow-2xl shadow-slate-900/50 backdrop-blur z-[9999]"
    : "absolute right-0 top-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] transform overflow-visible rounded-3xl border border-slate-100 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur z-[9999]";

export function AppUserMenu({
  product,
  displayName,
  avatarSrc,
  sections = [],
  onSignOut,
  signOutLabel = "Sign out",
  identityLabel = "Signed in as",
  dark = false,
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
        <p className={cn(
          "text-xs font-semibold uppercase tracking-[0.35em]",
          dark ? "text-slate-300" : "text-slate-400"
        )}>
          {section.title}
        </p>
      ) : null}
      <div className="grid gap-2">
        {section.items.map((item, itemIndex) => {
          const content = (
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition",
                dark
                  ? item.disabled
                    ? "cursor-not-allowed opacity-50 border-white/10 bg-white/5"
                    : "border-white/15 bg-white/5 hover:border-white/25 hover:bg-white/10"
                  : item.disabled
                    ? "cursor-not-allowed opacity-50 border-slate-100 bg-white"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
              )}
            >
              {item.icon ? (
                <span className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl",
                  dark ? "bg-white/10" : "bg-slate-100/60"
                )}>
                  {item.icon}
                </span>
              ) : null}
              <div className={cn(
                "flex flex-1 flex-col text-left",
                dark ? "text-slate-100" : "text-slate-700"
              )}>
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className={cn(
                    "text-xs",
                    dark ? "text-slate-400" : "text-slate-500"
                  )}>
                    {item.description}
                  </span>
                ) : null}
              </div>
              {item.badge ? (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  dark
                    ? "bg-white/10 text-slate-300"
                    : "bg-slate-100 text-slate-500"
                )}>
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
          <CardTitle className={cn(
            "flex items-center gap-3 text-base font-semibold",
            dark ? "text-white" : "text-slate-900"
          )}>
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt="User avatar"
                width={48}
                height={48}
                className={cn(
                  "h-12 w-12 rounded-full border object-cover shadow-sm",
                  dark ? "border-white/20" : "border-slate-100"
                )}
              />
            ) : (
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold",
                dark
                  ? "border-white/20 bg-white/10 text-slate-200"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              )}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className={cn(
                "text-xs font-medium uppercase tracking-[0.3em]",
                dark ? "text-slate-300" : "text-slate-400"
              )}>
                {identityLabel}
              </span>
              <span className={cn(
                "text-sm font-semibold truncate",
                dark ? "text-white" : "text-slate-900"
              )}>
                {displayName}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>
      <div className="space-y-6">
        {menuSections.map((section, index) => renderSection(section, index))}
      </div>
      {onSignOut ? (
        <div className={cn(
          "flex flex-col gap-3 border-t pt-4",
          dark ? "border-white/10" : "border-slate-100"
        )}>
          <Button
            variant="outline"
            className={cn(
              "justify-start gap-2 text-sm font-semibold",
              dark
                ? "border-white/20 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
                : "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900"
            )}
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
    <div className="relative z-[9998] flex w-full items-center gap-2 md:w-auto md:justify-end">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "md:hidden -ml-1",
          dark ? "text-white hover:bg-white/10" : ""
        )}
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <button
        type="button"
        className={cn(
          "hidden items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm shadow-sm transition md:flex",
          dark
            ? "border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
        )}
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
            className={cn(
              "h-7 w-7 rounded-full border object-cover shadow",
              dark ? "border-white/20" : "border-slate-100"
            )}
          />
        ) : (
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
            dark
              ? "border-white/20 bg-white/10 text-slate-200"
              : "border-slate-200 bg-slate-100 text-slate-600"
          )}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-medium">{displayName}</span>
      </button>
      {menuOpen ? (
        <div ref={dropdownRef} className={getDropdownClasses(dark)}>
          <div className="p-6">{menuContent}</div>
        </div>
      ) : null}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className={cn(
            "w-[85vw] max-w-none border-r px-6 backdrop-blur transition-all duration-300 data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full",
            dark
              ? "border-white/10 bg-slate-900/95"
              : "border-slate-100 bg-white/95"
          )}
        >
          <SheetHeader className="flex flex-row items-center justify-between gap-4">
            <SheetTitle className={cn(
              "text-left text-base font-semibold",
              dark ? "text-white" : "text-slate-900"
            )}>
              Menu
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}>
              <X className={cn("h-5 w-5", dark ? "text-white" : "")} />
            </Button>
          </SheetHeader>
          <div className="mt-6 space-y-6">{menuContent}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
