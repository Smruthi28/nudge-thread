"use client";

import clsx from "clsx";
import { CalendarPlus, Check, ListChecks, SplitSquareHorizontal, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatEventDate, formatMoney, perPerson } from "@/lib/format";
import type { Suggestion } from "@/lib/types";
import { Button } from "../ui";

const META = {
  event: { icon: CalendarPlus, accept: "Add to calendar", done: "Added to calendar" },
  checklist: { icon: ListChecks, accept: "Create checklist", done: "Checklist created" },
  split: { icon: SplitSquareHorizontal, accept: "Split cost", done: "Added to costs" },
} as const;

function describe(s: Suggestion) {
  switch (s.kind) {
    case "event":
      return { title: s.title, detail: formatEventDate(s.start, s.allDay) };
    case "checklist":
      return { title: s.title, detail: `${s.items.length} items` };
    case "split":
      return {
        title: `${formatMoney(perPerson(s.total, s.people))} each`,
        detail: `${s.label} · ${formatMoney(s.total)} ÷ ${s.people}`,
      };
  }
}

export function Nudge({ messageId, suggestion, mine }: { messageId: string; suggestion: Suggestion; mine: boolean }) {
  const { dispatch, announce } = useStore();
  if (suggestion.status === "dismissed") return null;

  const meta = META[suggestion.kind];
  const Icon = meta.icon;
  const { title, detail } = describe(suggestion);
  const accepted = suggestion.status === "accepted";
  const ids = { messageId, suggestionId: suggestion.id };

  if (accepted) {
    return (
      <div
        className={clsx(
          "flex animate-fade-up items-center gap-2 rounded-xl border border-ok/25 bg-ok-soft px-3 py-1.5 text-[13px]",
          mine && "self-end",
        )}
      >
        <Check size={14} className="text-ok" strokeWidth={2.5} aria-hidden="true" />
        <span className="font-medium text-ok">{meta.done}</span>
        <span className="truncate text-muted">· {title}</span>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "undo", ...ids });
            announce(`Undone. ${title} removed from the plan.`);
          }}
          className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-muted hover:bg-surface hover:text-fg"
        >
          <Undo2 size={13} aria-hidden="true" />
          Undo
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label={`Suggestion: ${meta.accept}, ${title}`}
      className={clsx(
        "w-full max-w-[420px] animate-nudge-in rounded-xl border border-accent/25 bg-surface p-3 shadow-card",
        mine && "self-end",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden="true">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Suggested</p>
          <p className="truncate text-sm font-semibold text-fg">{title}</p>
          <p className="truncate text-[13px] text-muted">{detail}</p>
          {suggestion.kind === "checklist" && (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="Items">
              {suggestion.items.map((item) => (
                <li key={item} className="rounded-md bg-raised px-1.5 py-0.5 text-xs text-muted">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            dispatch({ type: "accept", ...ids });
            announce(`${meta.done}: ${title}. Undo is available.`);
          }}
        >
          <Icon size={14} aria-hidden="true" />
          {meta.accept}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            dispatch({ type: "dismiss", ...ids });
            announce("Suggestion dismissed.");
          }}
        >
          Not now
        </Button>
      </div>
    </section>
  );
}
