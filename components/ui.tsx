"use client";

import clsx from "clsx";
import { forwardRef } from "react";
import { PEOPLE } from "@/lib/seed";
import type { Person } from "@/lib/types";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-strong dark:hover:bg-accent-strong shadow-sm",
  secondary: "bg-surface text-fg border border-line hover:bg-raised",
  ghost: "text-muted hover:text-fg hover:bg-raised",
  danger: "text-bad hover:bg-bad-soft",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }
>(function Button({ variant = "secondary", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
});

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const AVATAR_BG: Record<Person, string> = {
  maya: "bg-maya/15 text-maya",
  dev: "bg-dev/15 text-dev",
  you: "bg-accent-soft text-accent",
};

export function Avatar({ person, size = 32, className }: { person: Person; size?: number; className?: string }) {
  const p = PEOPLE[person];
  return (
    <span
      aria-hidden="true"
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", AVATAR_BG[person], className)}
      style={{ width: size, height: size, fontSize: person === "you" ? size * 0.32 : size * 0.42 }}
    >
      {p.initials}
    </span>
  );
}

export function SectionHeading({
  id,
  icon,
  title,
  count,
  action,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-muted" aria-hidden="true">
        {icon}
      </span>
      <h3 id={id} className="text-sm font-semibold text-fg">{title}</h3>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-raised px-1.5 text-xs font-medium text-muted">{count}</span>
      )}
      <div className="ml-auto">{action}</div>
    </div>
  );
}
