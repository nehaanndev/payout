"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackToHomeLinkProps = {
  label?: string;
  className?: string;
};

export function BackToHomeLink({
  label = "Back to homepage",
  className,
}: BackToHomeLinkProps) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "w-fit",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}
