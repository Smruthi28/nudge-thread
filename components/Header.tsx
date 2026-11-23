"use client";

import clsx from "clsx";
import { Check, CloudOff, Info, Loader2, Monitor, Moon, RotateCcw, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore, type SyncStatus } from "@/lib/store";
import { IconButton } from "./ui";

const SYNC: Record<SyncStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  synced: { label: "Synced", icon: <Check size={13} strokeWidth={2.5} />, cls: "bg-ok-soft text-ok" },
  syncing: { label: "Syncing", icon: <Loader2 size={13} className="animate-spin" />, cls: "bg-accent-soft text-accent" },
  offline: { label: "Offline", icon: <CloudOff size={13} />, cls: "bg-warn-soft text-warn" },
};

export function SyncPill() {
  const { syncStatus, state } = useStore();
  const queued = state.messages.filter((m) => m.status !== "sent").length;
  const s = SYNC[syncStatus];
  return (
    <span
      role="status"
      className={clsx("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors", s.cls)}
    >
      {s.icon}
      {s.label}
      {syncStatus === "offline" && queued > 0 && <span className="font-medium opacity-80">· {queued} queued</span>}
    </span>
  );
}

function OfflineToggle() {
  const { online, setOnline } = useStore();
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-muted">
      <span className="hidden sm:inline">Go offline</span>
      <button
        type="button"
        role="switch"
        aria-checked={!online}
        aria-label="Go offline"
        onClick={() => setOnline(!online)}
        className={clsx(
          "relative h-5 w-9 rounded-full transition-colors",
          online ? "bg-line" : "bg-warn",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            online ? "translate-x-0.5" : "translate-x-[18px]",
          )}
        />
      </button>
    </label>
  );
}

type Theme = "system" | "light" | "dark";

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      setTheme((localStorage.getItem("nudge-theme") as Theme) || "system");
    } catch {}
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const icon = theme === "system" ? <Monitor size={17} /> : theme === "light" ? <Sun size={17} /> : <Moon size={17} />;

  return (
    <IconButton
      label={`Theme: ${theme}. Switch to ${next}`}
      onClick={() => {
        setTheme(next);
        try {
          localStorage.setItem("nudge-theme", next);
        } catch {}
      }}
    >
      {icon}
    </IconButton>
  );
}

function AboutDialog({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="about-title"
      className="w-[min(560px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-black/40"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="about-title" className="text-lg font-semibold">About this demo</h2>
            <p className="mt-1 text-sm text-muted">
              An independent concept, not an Act product. It uses no Act data or systems.
            </p>
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X size={18} />
          </IconButton>
        </div>
        <p className="mt-4 text-sm leading-relaxed">
          Most products bolt AI on as a chatbot. Nudge Thread has none: it reads the conversation you&apos;re already
          having and suggests the next useful action. Nothing happens without your approval.
        </p>
        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-ok">Real</dt>
            <dd className="text-muted">
              Interaction design, state management, offline queue, cross-tab sync, recalculating cost table, rich-text
              editor, accessibility.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-warn">Mocked</dt>
            <dd className="text-muted">
              The AI is rule-based pattern matching in <code className="rounded bg-raised px-1">detect()</code> and{" "}
              <code className="rounded bg-raised px-1">tighten()</code>. A model call would replace them without changing
              the interface. Maya&apos;s and Dev&apos;s replies are scripted.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-subtle">Not included</dt>
            <dd className="text-muted">
              Accounts, a backend, a database, true multi-user collaboration or conflict resolution. Cross-tab sync is
              last-change-wins, not a CRDT.
            </dd>
          </div>
        </dl>
        <div className="mt-5 rounded-xl bg-raised p-3 text-[13px] text-muted">
          <span className="font-semibold text-fg">Try it:</span> accept a nudge in the chat, open this page in a second
          tab, flip “Go offline” and send a message, or pause while typing in Trip notes.
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-raised"
          >
            <RotateCcw size={15} aria-hidden="true" /> Reset demo
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function Header() {
  const { reset } = useStore();
  const [about, setAbout] = useState(false);
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg" aria-hidden="true">
          <Sparkles size={17} />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-tight">Nudge Thread</h1>
          <p className="hidden truncate text-[11px] leading-tight text-subtle sm:block">Concept demo · not an Act product</p>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <SyncPill />
        <OfflineToggle />
        <div className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
        <ThemeToggle />
        <IconButton label="Reset demo" onClick={reset} className="hidden sm:inline-flex">
          <RotateCcw size={17} />
        </IconButton>
        <IconButton label="About this demo" onClick={() => setAbout(true)}>
          <Info size={17} />
        </IconButton>
      </div>
      {about && <AboutDialog onClose={() => setAbout(false)} onReset={reset} />}
    </header>
  );
}
