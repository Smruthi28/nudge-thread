"use client";

import clsx from "clsx";
import { CalendarDays, Check, ListChecks, Plus, Receipt, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { formatMoney, perPerson } from "@/lib/format";
import type { CalendarEvent, Checklist, Cost } from "@/lib/types";
import { useFresh } from "@/lib/useFresh";
import { Button, IconButton, SectionHeading } from "../ui";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-subtle">{children}</p>;
}

/* ---------------------------------------------------------------- Calendar */

function CalendarSection() {
  const { state } = useStore();
  const events = [...state.events].sort((a, b) => a.start.localeCompare(b.start));
  return (
    <section aria-labelledby="cal-h">
      <SectionHeading id="cal-h" icon={<CalendarDays size={16} />} title="Calendar" count={events.length} />
      {events.length === 0 ? (
        <Empty>Accept a date suggestion in the chat and it lands here.</Empty>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EventRow({ e }: { e: CalendarEvent }) {
  const { dispatch, announce } = useStore();
  const fresh = useFresh(e.id);
  const d = new Date(e.start);
  return (
              <li className={clsx("group flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 pr-1.5", fresh && "animate-flash")}>
                <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-accent-soft py-1 text-accent" aria-hidden="true">
                  <span className="text-[10px] font-semibold uppercase leading-none">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.title}</p>
                  <p className="text-[13px] text-muted">
                    {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" · "}
                    {e.allDay ? "All day" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <IconButton
                  label={`Remove ${e.title}`}
                  className="h-8 w-8 opacity-100 sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
                  onClick={() => {
                    dispatch({ type: "removeEvent", id: e.id });
                    announce(`${e.title} removed from calendar.`);
                  }}
                >
                  <X size={15} />
                </IconButton>
              </li>
  );
}

/* -------------------------------------------------------------- Checklists */

function ChecklistCard({ list }: { list: Checklist }) {
  const { dispatch, announce } = useStore();
  const [draft, setDraft] = useState("");
  const fresh = useFresh(list.id);
  const done = list.items.filter((i) => i.done).length;
  const pct = list.items.length ? (done / list.items.length) * 100 : 0;

  return (
    <div className={clsx("rounded-xl border border-line bg-surface p-3", fresh && "animate-flash")}>
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">{list.title}</h4>
        <span className="text-xs text-subtle">
          {done}/{list.items.length}
        </span>
        <IconButton
          label={`Delete ${list.title}`}
          className="ml-auto h-7 w-7"
          onClick={() => {
            dispatch({ type: "removeChecklist", id: list.id });
            announce(`${list.title} deleted.`);
          }}
        >
          <Trash2 size={14} />
        </IconButton>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div className="h-full rounded-full bg-ok transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-2 space-y-0.5">
        {list.items.map((item) => (
          <li key={item.id} className="group flex items-center gap-1">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-raised">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => dispatch({ type: "toggleItem", listId: list.id, itemId: item.id })}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={clsx(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1",
                  item.done ? "border-ok bg-ok text-white" : "border-line bg-surface",
                )}
              >
                {item.done && <Check size={12} strokeWidth={3} />}
              </span>
              <span className={clsx("truncate text-sm transition-colors", item.done && "text-subtle line-through")}>{item.text}</span>
            </label>
            <IconButton
              label={`Remove ${item.text}`}
              className="h-7 w-7 opacity-100 sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
              onClick={() => dispatch({ type: "removeItem", listId: list.id, itemId: item.id })}
            >
              <X size={13} />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-1.5 flex items-center gap-2 px-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          dispatch({ type: "addItem", listId: list.id, text: draft });
          setDraft("");
        }}
      >
        <Plus size={15} className="shrink-0 text-subtle" aria-hidden="true" />
        <label className="sr-only" htmlFor={`add-${list.id}`}>
          Add item to {list.title}
        </label>
        <input
          id={`add-${list.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add item"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle focus-visible:outline-none"
        />
      </form>
    </div>
  );
}

function ChecklistSection() {
  const { state } = useStore();
  return (
    <section aria-labelledby="lists-h">
      <SectionHeading id="lists-h" icon={<ListChecks size={16} />} title="Checklists" count={state.checklists.length} />
      {state.checklists.length === 0 ? (
        <Empty>Lists like “Bring: chairs, ice” become shared checklists anyone can tick off.</Empty>
      ) : (
        <div className="space-y-3">
          {state.checklists.map((l) => (
            <ChecklistCard key={l.id} list={l} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- Costs */

/** Number input that keeps a local draft so typing "" or "4." doesn't fight the store. */
function NumberCell({
  value,
  onCommit,
  label,
  min,
  step,
  prefix,
}: {
  value: number;
  onCommit: (n: number) => void;
  label: string;
  min: number;
  step: number;
  prefix?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-subtle">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        min={min}
        step={step}
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDraft(String(value));
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n) && n >= min) onCommit(n);
        }}
        className={clsx(
          "h-8 w-full rounded-md border border-transparent bg-transparent text-right text-[13px] tabular-nums outline-none hover:border-line focus:border-accent/50 focus:bg-surface focus-visible:outline-none",
          prefix ? "pl-5 pr-2" : "px-2",
        )}
      />
    </div>
  );
}

function CostRow({ cost }: { cost: Cost }) {
  const { dispatch } = useStore();
  const fresh = useFresh(cost.id);
  const update = (patch: Partial<Cost>) => dispatch({ type: "updateCost", id: cost.id, patch });
  return (
    <tr className={clsx("group border-t border-line", fresh && "animate-flash")}>
      <td className="py-1 pl-1">
        <input
          aria-label="Item"
          value={cost.label}
          onChange={(e) => update({ label: e.target.value })}
          className="h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium outline-none hover:border-line focus:border-accent/50 focus:bg-surface focus-visible:outline-none"
        />
      </td>
      <td className="w-[92px] py-1">
        <NumberCell label={`${cost.label} total`} value={cost.total} min={0} step={1} prefix="$" onCommit={(total) => update({ total })} />
      </td>
      <td className="w-[60px] py-1">
        <NumberCell
          label={`${cost.label} people`}
          value={cost.people}
          min={1}
          step={1}
          onCommit={(people) => update({ people: Math.max(1, Math.round(people)) })}
        />
      </td>
      <td className="w-[78px] py-1 pr-2 text-right text-[13px] font-semibold tabular-nums text-accent">
        {formatMoney(perPerson(cost.total, cost.people))}
      </td>
      <td className="w-8 py-1">
        <IconButton label={`Remove ${cost.label}`} className="h-7 w-7" onClick={() => dispatch({ type: "removeCost", id: cost.id })}>
          <X size={13} />
        </IconButton>
      </td>
    </tr>
  );
}

function CostsSection() {
  const { state, dispatch } = useStore();
  const total = state.costs.reduce((s, c) => s + (c.total || 0), 0);
  const share = state.costs.reduce((s, c) => s + perPerson(c.total, c.people), 0);
  return (
    <section aria-labelledby="costs-h">
      <SectionHeading
        id="costs-h"
        icon={<Receipt size={16} />}
        title="Costs"
        count={state.costs.length}
        action={
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "addCost" })}>
            <Plus size={14} aria-hidden="true" /> Add
          </Button>
        }
      />
      {state.costs.length === 0 ? (
        <Empty>Mention a price and a head count, like “$480, 3 of us”, to split it.</Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full table-fixed">
            <caption className="sr-only">Shared costs. Per-person amounts recalculate as you edit.</caption>
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                <th scope="col" className="py-2 pl-3 text-left">Item</th>
                <th scope="col" className="w-[92px] py-2 pr-2 text-right">Total</th>
                <th scope="col" className="w-[60px] py-2 pr-2 text-right">
                  <span aria-hidden="true">Ppl</span>
                  <span className="sr-only">People</span>
                </th>
                <th scope="col" className="w-[78px] py-2 pr-2 text-right">Each</th>
                <th scope="col" className="w-8"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {state.costs.map((c) => (
                <CostRow key={c.id} cost={c} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-raised/60 text-[13px]">
                <th scope="row" className="py-2.5 pl-3 text-left font-semibold">Trip total</th>
                <td className="py-2.5 pr-2 text-right font-semibold tabular-nums">{formatMoney(total)}</td>
                <td />
                <td className="py-2.5 pr-2 text-right font-bold tabular-nums text-accent">{formatMoney(share)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <p className="border-t border-line px-3 py-2 text-xs text-subtle">
            Your share: <span className="font-semibold text-fg">{formatMoney(share)}</span>
          </p>
        </div>
      )}
    </section>
  );
}

export function PlanView() {
  return (
    <div className="space-y-6">
      <CalendarSection />
      <ChecklistSection />
      <CostsSection />
    </div>
  );
}
