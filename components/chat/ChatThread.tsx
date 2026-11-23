"use client";

import clsx from "clsx";
import { Check, CheckCheck, Clock, Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PEOPLE } from "@/lib/seed";
import { formatClock } from "@/lib/format";
import type { Message } from "@/lib/types";
import { Avatar } from "../ui";
import { Nudge } from "./Nudge";

/** Renders message text with the AI-detected fragments subtly underlined. */
function HighlightedText({ message }: { message: Message }) {
  const matches = message.suggestions.filter((s) => s.status !== "dismissed").map((s) => s.match);
  if (!matches.length) return <>{message.text}</>;

  const ranges: [number, number][] = [];
  for (const m of matches) {
    const i = message.text.indexOf(m);
    if (i >= 0) ranges.push([i, i + m.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const out: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([start, end], k) => {
    if (start < pos) return;
    if (start > pos) out.push(message.text.slice(pos, start));
    out.push(
      <mark
        key={k}
        className={clsx(
          "rounded-sm bg-transparent text-inherit underline decoration-dotted decoration-2 underline-offset-4",
          message.author === "you" ? "decoration-white/70 dark:decoration-black/50" : "decoration-accent/60",
        )}
      >
        {message.text.slice(start, end)}
      </mark>,
    );
    pos = end;
  });
  if (pos < message.text.length) out.push(message.text.slice(pos));
  return <>{out}</>;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  if (status === "queued")
    return (
      <span className="inline-flex items-center gap-1 text-warn">
        <Clock size={12} aria-hidden="true" /> Queued
      </span>
    );
  if (status === "sending")
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Sending
      </span>
    );
  return (
    <span className="inline-flex items-center" aria-label="Sent">
      <CheckCheck size={13} className="text-accent" aria-hidden="true" />
    </span>
  );
}

function MessageRow({ message, grouped }: { message: Message; grouped: boolean }) {
  const mine = message.author === "you";
  const name = PEOPLE[message.author].name;
  return (
    <li className={clsx("flex animate-fade-up gap-2.5", mine && "flex-row-reverse", grouped ? "mt-1" : "mt-4")}>
      <div className="w-8 shrink-0">{!grouped && !mine && <Avatar person={message.author} />}</div>
      <div className={clsx("flex min-w-0 max-w-[85%] flex-col gap-1.5 sm:max-w-[75%]", mine && "items-end")}>
        {!grouped && (
          <div className={clsx("flex items-baseline gap-2 px-1 text-xs", mine && "flex-row-reverse")}>
            <span className="font-semibold text-fg">{name}</span>
            <time className="text-subtle" dateTime={new Date(message.ts).toISOString()}>
              {formatClock(message.ts)}
            </time>
          </div>
        )}
        <div
          className={clsx(
            "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug",
            mine ? "rounded-tr-md bg-accent text-accent-fg" : "rounded-tl-md bg-surface text-fg shadow-card",
            message.status === "queued" && "opacity-70",
          )}
        >
          <span className="sr-only">{name}: </span>
          <HighlightedText message={message} />
        </div>
        {mine && (
          <div className="px-1 text-[11px] text-subtle">
            <StatusIcon status={message.status} />
          </div>
        )}
        {message.suggestions.map((s) => (
          <Nudge key={s.id} messageId={message.id} suggestion={s} mine={mine} />
        ))}
      </div>
    </li>
  );
}

function TypingIndicator() {
  const { state } = useStore();
  if (!state.typing.length) return null;
  const who = state.typing.map((p) => PEOPLE[p].name).join(" and ");
  return (
    <div className="mt-4 flex animate-fade-up items-center gap-2.5" aria-hidden="true">
      <Avatar person={state.typing[0]} />
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-surface px-3.5 py-2.5 shadow-card">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-subtle" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
        <span className="text-xs text-muted">{who} is typing</span>
      </div>
    </div>
  );
}

const TRY = ["Breakfast Sunday at 9am", "Snacks: chips, salsa, lemonade", "Gas was $60, split 3 ways"];

function Composer() {
  const { send, online } = useStore();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const submit = () => {
    if (!text.trim()) return;
    send(text);
    setText("");
  };

  return (
    <div className="border-t border-line bg-surface px-3 pb-3 pt-2 sm:px-5">
      <div className="scroll-thin -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Example messages">
        <span className="shrink-0 self-center text-xs text-subtle">Try:</span>
        {TRY.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setText(t);
              ref.current?.focus();
            }}
            className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:text-fg"
          >
            {t}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-xl border border-line bg-canvas px-3 py-2 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15"
      >
        <label htmlFor="composer" className="sr-only">
          Message Lake weekend
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={online ? "Message Lake weekend" : "Offline. Messages will queue"}
          className="max-h-[140px] flex-1 resize-none bg-transparent py-1 text-[15px] text-fg outline-none placeholder:text-subtle focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={online ? "Send message" : "Queue message"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg transition-opacity disabled:opacity-40"
        >
          <SendHorizontal size={16} aria-hidden="true" />
        </button>
      </form>
      <p className="mt-1.5 hidden text-[11px] text-subtle sm:block">
        Enter to send · Shift+Enter for a new line · nudges appear when a message has a date, a list or a cost
      </p>
    </div>
  );
}

export function ChatThread() {
  const { state } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const last = state.messages[state.messages.length - 1];

  // Keep pinned to the bottom when new messages or typing arrive, unless the user scrolled up.
  const pinned = useRef(true);
  const first = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [state.messages.length, state.typing.length, last?.status]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-5">
        <div className="flex -space-x-2" aria-hidden="true">
          <Avatar person="maya" size={28} className="ring-2 ring-surface" />
          <Avatar person="dev" size={28} className="ring-2 ring-surface" />
          <Avatar person="you" size={28} className="ring-2 ring-surface" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Lake weekend 🏕️</h2>
          <p className="text-xs text-subtle">Maya, Dev and you</p>
        </div>
        <span className="ml-auto hidden items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent md:inline-flex">
          <Check size={12} aria-hidden="true" /> AI suggestions on
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-5"
      >
        <p className="mx-auto mt-4 w-fit rounded-full bg-raised px-3 py-1 text-xs text-subtle">Today</p>
        <ol aria-label="Messages" className="flex flex-col">
          {state.messages.map((m, i) => {
            const prev = state.messages[i - 1];
            const grouped = !!prev && prev.author === m.author && m.ts - prev.ts < 5 * 60_000;
            return <MessageRow key={m.id} message={m} grouped={grouped} />;
          })}
        </ol>
        <TypingIndicator />
      </div>
      <Composer />
    </div>
  );
}
