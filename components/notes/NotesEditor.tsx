"use client";

import clsx from "clsx";
import { Bold, CalendarCheck, Italic, List, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { tighten } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { Button } from "../ui";

const PAUSE_MS = 1100;

interface TightenSuggestion {
  original: string;
  revised: string;
}

/** Each visual line of the editor: top-level blocks, with list items expanded. */
function getBlocks(root: HTMLElement): Node[] {
  const out: Node[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "UL" || el.tagName === "OL") el.querySelectorAll(":scope > li").forEach((li) => out.push(li));
      else out.push(el);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      out.push(node);
    }
  });
  return out;
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

type Format = "bold" | "italic" | "insertUnorderedList";

function Toolbar({ active, onFormat }: { active: Record<Format, boolean>; onFormat: (f: Format) => void }) {
  const tools: { f: Format; label: string; keys: string; icon: React.ReactNode }[] = [
    { f: "bold", label: "Bold", keys: "Ctrl+B", icon: <Bold size={15} /> },
    { f: "italic", label: "Italic", keys: "Ctrl+I", icon: <Italic size={15} /> },
    { f: "insertUnorderedList", label: "Bulleted list", keys: "Ctrl+Shift+8", icon: <List size={15} /> },
  ];
  return (
    <div role="toolbar" aria-label="Text formatting" aria-controls="trip-notes" className="flex gap-0.5 border-b border-line px-2 py-1.5">
      {tools.map((t) => (
        <button
          key={t.f}
          type="button"
          aria-pressed={active[t.f]}
          aria-label={`${t.label} (${t.keys})`}
          title={`${t.label} (${t.keys})`}
          // Keep the editor's selection when clicking.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormat(t.f)}
          className={clsx(
            "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            active[t.f] ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised hover:text-fg",
          )}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

export function NotesEditor() {
  const { state, dispatch, announce } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [suggestion, setSuggestion] = useState<TightenSuggestion | null>(null);
  const [active, setActive] = useState<Record<Format, boolean>>({ bold: false, italic: false, insertUnorderedList: false });
  const dismissedRef = useRef(state.dismissedTightens);
  dismissedRef.current = state.dismissedTightens;

  /* Find the first line worth tightening. */
  const scan = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    for (const block of getBlocks(el)) {
      const text = (block.textContent ?? "").trim();
      if (!text || dismissedRef.current.includes(text)) continue;
      const revised = tighten(text);
      if (revised) {
        setSuggestion((prev) => {
          if (prev?.original === text) return prev;
          announce("AI edit suggested for a line in your notes.");
          return { original: text, revised };
        });
        return;
      }
    }
    setSuggestion(null);
  }, [announce]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(scan, PAUSE_MS);
  }, [scan]);

  /* Apply shared notes (from another tab, an accepted offer, or reset) without clobbering identical DOM. */
  useEffect(() => {
    const el = ref.current;
    if (!el || el.innerHTML === state.notesHtml) return;
    const focused = document.activeElement === el;
    el.innerHTML = state.notesHtml;
    if (focused) placeCaretAtEnd(el);
    schedule();
  }, [state.notesHtml, schedule]);

  /* First open: look for something to suggest after a short pause. */
  useEffect(() => {
    schedule();
    return () => clearTimeout(timer.current);
  }, [schedule]);

  /* Track formatting state for the toolbar's aria-pressed. */
  useEffect(() => {
    const onSel = () => {
      const el = ref.current;
      const sel = window.getSelection();
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const commit = () => {
    const el = ref.current;
    if (el) dispatch({ type: "setNotes", html: el.innerHTML });
  };

  const format = (f: Format) => {
    ref.current?.focus();
    document.execCommand(f);
    commit();
    setActive((a) => ({ ...a, [f]: document.queryCommandState(f) }));
  };

  const acceptSuggestion = () => {
    const el = ref.current;
    if (!el || !suggestion) return;
    const block = getBlocks(el).find((b) => (b.textContent ?? "").trim() === suggestion.original);
    if (block) {
      block.textContent = suggestion.revised;
      commit();
      announce(`Edit applied: ${suggestion.revised}`);
    }
    setSuggestion(null);
    schedule();
  };

  const dismissSuggestion = () => {
    if (!suggestion) return;
    dispatch({ type: "dismissTighten", line: suggestion.original });
    announce("Edit dismissed.");
    setSuggestion(null);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-line bg-surface focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
        <Toolbar active={active} onFormat={format} />
        <div
          id="trip-notes"
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label="Trip notes"
          aria-describedby="notes-help"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          data-placeholder="Jot down plans, ideas, reminders…"
          className="notes-editor min-h-[180px] px-4 py-3"
          onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
          onInput={() => {
            commit();
            schedule();
          }}
          onPaste={(e) => {
            // Strip formatting: pasted content always arrives as plain text.
            e.preventDefault();
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          }}
          onKeyDown={(e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            const k = e.key.toLowerCase();
            if (k === "b") {
              e.preventDefault();
              format("bold");
            } else if (k === "i") {
              e.preventDefault();
              format("italic");
            } else if (e.shiftKey && (k === "8" || k === "*")) {
              e.preventDefault();
              format("insertUnorderedList");
            }
          }}
        />
      </div>
      <p id="notes-help" className="flex items-center gap-1.5 px-1 text-xs text-subtle">
        <Sparkles size={12} aria-hidden="true" />
        Pause typing and AI suggests a tighter version of a line. Pasted text comes in as plain text.
      </p>

      {suggestion && (
        <section aria-label="Suggested edit" className="animate-nudge-in rounded-xl border border-accent/25 bg-surface p-3 shadow-card">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            <Sparkles size={12} aria-hidden="true" /> Tighten this line
          </p>
          <div className="mt-2 space-y-1 text-sm leading-snug">
            <del className="block text-subtle decoration-bad/60">
              <span className="sr-only">Original: </span>
              {suggestion.original}
            </del>
            <ins className="block font-medium text-fg no-underline">
              <span className="sr-only">Suggested: </span>
              {suggestion.revised}
            </ins>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={acceptSuggestion}>
              Accept edit
            </Button>
            <Button variant="ghost" size="sm" onClick={dismissSuggestion}>
              Dismiss
            </Button>
          </div>
        </section>
      )}

      {state.notesOffers.map((offer) => (
        <section key={offer.id} aria-label="Suggested addition" className="animate-nudge-in rounded-xl border border-ok/30 bg-surface p-3 shadow-card">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ok">
            <CalendarCheck size={12} aria-hidden="true" /> Event confirmed. Add to notes?
          </p>
          <p className="mt-2 text-sm font-medium">
            <span className="text-ok" aria-hidden="true">+ </span>
            {offer.text}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                dispatch({ type: "acceptOffer", id: offer.id });
                announce(`Added to notes: ${offer.text}`);
              }}
            >
              Add line
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch({ type: "dismissOffer", id: offer.id });
                announce("Dismissed.");
              }}
            >
              Dismiss
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}
