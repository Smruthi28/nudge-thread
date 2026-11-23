"use client";

import clsx from "clsx";
import { ClipboardList, MessageCircle, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { ChatThread } from "./chat/ChatThread";
import { Header } from "./Header";
import { NotesEditor } from "./notes/NotesEditor";
import { PlanView } from "./plan/PlanPanel";

interface TabDef<T extends string> {
  id: T;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

/** Accessible tablist: roving tabindex, arrow/Home/End keys. */
function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  idPrefix,
  label,
  className,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (v: T) => void;
  idPrefix: string;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={clsx("flex gap-1 rounded-xl bg-raised p-1", className)}>
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={clsx(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-all",
              selected ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
            )}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
            {!!t.badge && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">
                {t.badge}
                <span className="sr-only"> new</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type SideTab = "plan" | "notes";

function SidePanel() {
  const { state } = useStore();
  const [tab, setTab] = useState<SideTab>("plan");
  const planCount = state.events.length + state.checklists.length + state.costs.length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-surface px-4 py-2.5">
        <Tabs<SideTab>
          label="Trip planning"
          idPrefix="side"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "plan", label: "Itinerary", icon: <ClipboardList size={14} />, badge: tab === "plan" ? 0 : planCount },
            { id: "notes", label: "Trip notes", icon: <NotebookPen size={14} />, badge: tab === "notes" ? 0 : state.notesOffers.length },
          ]}
        />
      </div>
      <div
        role="tabpanel"
        id={`side-panel-${tab}`}
        aria-labelledby={`side-tab-${tab}`}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-5"
      >
        {tab === "plan" ? <PlanView /> : <NotesEditor />}
      </div>
    </div>
  );
}

type MobileTab = "chat" | "plan";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

function LiveRegion() {
  const { announcement } = useStore();
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}

export function AppShell() {
  const { state, ready } = useStore();
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const planCount = state.events.length + state.checklists.length + state.costs.length;
  const [seenPlan, setSeenPlan] = useState(planCount);
  const desktop = useIsDesktop();
  const panelProps = (id: MobileTab) =>
    desktop ? {} : { role: "tabpanel", id: `m-panel-${id}`, "aria-labelledby": `m-tab-${id}` };

  useEffect(() => {
    if (mobileTab === "plan") setSeenPlan(planCount);
  }, [mobileTab, planCount]);

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-subtle" role="status">
        Loading…
      </div>
    );
  }

  const newOnPlan = Math.max(0, planCount - seenPlan) + state.notesOffers.length;

  return (
    <div className="flex h-dvh flex-col">
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg">
        Skip to conversation
      </a>
      <Header />

      {/* Phones: switch between Chat and Plan instead of squeezing both. */}
      <div className="border-b border-line bg-surface px-3 py-2 lg:hidden">
        <Tabs<MobileTab>
          label="View"
          idPrefix="m"
          value={mobileTab}
          onChange={setMobileTab}
          tabs={[
            { id: "chat", label: "Chat", icon: <MessageCircle size={14} /> },
            { id: "plan", label: "Plan", icon: <ClipboardList size={14} />, badge: mobileTab === "plan" ? 0 : newOnPlan },
          ]}
        />
      </div>

      <main id="main" className="flex min-h-0 flex-1">
        <div
          {...panelProps("chat")}
          className={clsx("min-h-0 min-w-0 flex-1", mobileTab === "chat" ? "flex flex-col" : "hidden", "lg:flex lg:flex-col")}
        >
          <ChatThread />
        </div>
        <aside
          {...panelProps("plan")}
          aria-label={desktop ? "Trip plan" : undefined}
          className={clsx(
            "min-h-0 w-full border-line bg-canvas lg:w-[420px] lg:shrink-0 lg:border-l xl:w-[460px]",
            mobileTab === "plan" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <SidePanel />
        </aside>
      </main>
      <LiveRegion />
    </div>
  );
}
