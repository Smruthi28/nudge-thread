"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FALLBACK_REPLIES, PEOPLE, SCRIPT, createSeedState, makeMessage } from "./seed";
import { escapeHtml, formatEventDate, uid } from "./format";
import type { Cost, MessageStatus, Person, SharedState, Suggestion } from "./types";

const STORAGE_KEY = "nudge-thread:v1";
const CHANNEL = "nudge-thread";

/* ----------------------------------------------------------------------------
 * Reducer — every change to shared state goes through here
 * ------------------------------------------------------------------------- */

type Action =
  | { type: "send"; author: Person; text: string; status: MessageStatus }
  | { type: "setStatus"; id: string; status: MessageStatus }
  | { type: "setTyping"; people: Person[] }
  | { type: "advanceScript" }
  | { type: "accept"; messageId: string; suggestionId: string }
  | { type: "undo"; messageId: string; suggestionId: string }
  | { type: "dismiss"; messageId: string; suggestionId: string }
  | { type: "removeEvent"; id: string }
  | { type: "toggleItem"; listId: string; itemId: string }
  | { type: "addItem"; listId: string; text: string }
  | { type: "removeItem"; listId: string; itemId: string }
  | { type: "removeChecklist"; id: string }
  | { type: "updateCost"; id: string; patch: Partial<Omit<Cost, "id">> }
  | { type: "addCost" }
  | { type: "removeCost"; id: string }
  | { type: "setNotes"; html: string }
  | { type: "acceptOffer"; id: string }
  | { type: "dismissOffer"; id: string }
  | { type: "dismissTighten"; line: string };

type Envelope = { shared: SharedState; origin: "local" | "remote" | "load" };

type InternalAction = Action | { type: "replace"; state: SharedState; origin: "remote" | "load" };

function mapSuggestion(state: SharedState, messageId: string, suggestionId: string, fn: (s: Suggestion) => Suggestion) {
  return state.messages.map((m) =>
    m.id !== messageId ? m : { ...m, suggestions: m.suggestions.map((s) => (s.id === suggestionId ? fn(s) : s)) },
  );
}

function findSuggestion(state: SharedState, messageId: string, suggestionId: string) {
  return state.messages.find((m) => m.id === messageId)?.suggestions.find((s) => s.id === suggestionId);
}

function apply(state: SharedState, action: Action): SharedState {
  switch (action.type) {
    case "send":
      return { ...state, messages: [...state.messages, makeMessage(action.author, action.text, Date.now(), action.status)] };

    case "setStatus":
      return { ...state, messages: state.messages.map((m) => (m.id === action.id ? { ...m, status: action.status } : m)) };

    case "setTyping":
      return { ...state, typing: action.people };

    case "advanceScript":
      return { ...state, scriptIndex: state.scriptIndex + 1 };

    case "accept": {
      const s = findSuggestion(state, action.messageId, action.suggestionId);
      if (!s || s.status === "accepted") return state;
      const resultId = uid();
      const next = { ...state, messages: mapSuggestion(state, action.messageId, action.suggestionId, (x) => ({ ...x, status: "accepted" as const, resultId })) };
      if (s.kind === "event") {
        next.events = [...state.events, { id: resultId, title: s.title, start: s.start, allDay: s.allDay, sourceMessageId: action.messageId }];
        next.notesOffers = [...state.notesOffers, { id: uid(), eventId: resultId, text: `Confirmed: ${s.title}, ${formatEventDate(s.start, s.allDay)}` }];
      } else if (s.kind === "checklist") {
        next.checklists = [...state.checklists, { id: resultId, title: s.title, sourceMessageId: action.messageId, items: s.items.map((text) => ({ id: uid(), text, done: false })) }];
      } else {
        next.costs = [...state.costs, { id: resultId, label: s.label, total: s.total, people: s.people, sourceMessageId: action.messageId }];
      }
      return next;
    }

    case "undo": {
      const s = findSuggestion(state, action.messageId, action.suggestionId);
      if (!s || s.status !== "accepted") return state;
      const rid = s.resultId;
      return {
        ...state,
        messages: mapSuggestion(state, action.messageId, action.suggestionId, (x) => ({ ...x, status: "pending" as const, resultId: undefined })),
        events: state.events.filter((e) => e.id !== rid),
        checklists: state.checklists.filter((c) => c.id !== rid),
        costs: state.costs.filter((c) => c.id !== rid),
        notesOffers: state.notesOffers.filter((o) => o.eventId !== rid),
      };
    }

    case "dismiss":
      return { ...state, messages: mapSuggestion(state, action.messageId, action.suggestionId, (x) => ({ ...x, status: "dismissed" as const })) };

    case "removeEvent": {
      // Removing a plan item un-accepts its suggestion so the chat stays truthful.
      return {
        ...unlinkResult(state, action.id),
        events: state.events.filter((e) => e.id !== action.id),
        notesOffers: state.notesOffers.filter((o) => o.eventId !== action.id),
      };
    }

    case "toggleItem":
      return {
        ...state,
        checklists: state.checklists.map((c) =>
          c.id !== action.listId ? c : { ...c, items: c.items.map((i) => (i.id === action.itemId ? { ...i, done: !i.done } : i)) },
        ),
      };

    case "addItem": {
      const text = action.text.trim();
      if (!text) return state;
      return {
        ...state,
        checklists: state.checklists.map((c) => (c.id !== action.listId ? c : { ...c, items: [...c.items, { id: uid(), text, done: false }] })),
      };
    }

    case "removeItem":
      return {
        ...state,
        checklists: state.checklists.map((c) => (c.id !== action.listId ? c : { ...c, items: c.items.filter((i) => i.id !== action.itemId) })),
      };

    case "removeChecklist":
      return { ...unlinkResult(state, action.id), checklists: state.checklists.filter((c) => c.id !== action.id) };

    case "updateCost":
      return { ...state, costs: state.costs.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) };

    case "addCost":
      return { ...state, costs: [...state.costs, { id: uid(), label: "New cost", total: 0, people: 3 }] };

    case "removeCost":
      return { ...unlinkResult(state, action.id), costs: state.costs.filter((c) => c.id !== action.id) };

    case "setNotes":
      return state.notesHtml === action.html ? state : { ...state, notesHtml: action.html };

    case "acceptOffer": {
      const offer = state.notesOffers.find((o) => o.id === action.id);
      if (!offer) return state;
      return {
        ...state,
        notesHtml: `${state.notesHtml}<p>${escapeHtml(offer.text)}</p>`,
        notesOffers: state.notesOffers.filter((o) => o.id !== action.id),
      };
    }

    case "dismissOffer":
      return { ...state, notesOffers: state.notesOffers.filter((o) => o.id !== action.id) };

    case "dismissTighten":
      return { ...state, dismissedTightens: [...state.dismissedTightens, action.line] };
  }
}

function unlinkResult(state: SharedState, resultId: string): SharedState {
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.suggestions.some((s) => s.resultId === resultId)
        ? { ...m, suggestions: m.suggestions.map((s) => (s.resultId === resultId ? { ...s, status: "pending" as const, resultId: undefined } : s)) }
        : m,
    ),
  };
}

function reducer(env: Envelope, action: InternalAction): Envelope {
  if (action.type === "replace") {
    // Last-change-wins, but never drop this tab's unsent (queued) messages.
    const incoming = action.state;
    const ids = new Set(incoming.messages.map((m) => m.id));
    const unsent = env.shared.messages.filter((m) => m.status !== "sent" && !ids.has(m.id));
    const messages = unsent.length ? [...incoming.messages, ...unsent].sort((a, b) => a.ts - b.ts) : incoming.messages;
    return { shared: { ...incoming, messages }, origin: action.origin };
  }
  const next = apply(env.shared, action);
  if (next === env.shared) return env;
  return { shared: { ...next, updatedAt: Date.now() }, origin: "local" };
}

/* ----------------------------------------------------------------------------
 * Provider
 * ------------------------------------------------------------------------- */

export type SyncStatus = "synced" | "syncing" | "offline";

interface StoreValue {
  state: SharedState;
  ready: boolean;
  online: boolean;
  syncStatus: SyncStatus;
  announcement: string;
  dispatch: (a: Action) => void;
  send: (text: string) => void;
  setOnline: (online: boolean) => void;
  announce: (message: string) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SUGGESTION_LABEL: Record<Suggestion["kind"], string> = {
  event: "add to calendar",
  checklist: "make a checklist",
  split: "split the cost",
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [env, rawDispatch] = useReducer(reducer, undefined, () => ({ shared: createSeedState(), origin: "load" as const }));
  const [ready, setReady] = useState(false);
  const [online, setOnlineState] = useState(true);
  const [busy, setBusy] = useState(0); // in-flight sync operations
  const [announcement, setAnnouncement] = useState("");

  const stateRef = useRef(env.shared);
  stateRef.current = env.shared;
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const channelRef = useRef<BroadcastChannel | null>(null);
  const heldIncoming = useRef<{ author: Person; text: string }[]>([]);
  const turnQueue = useRef(0);
  const playingRef = useRef(false);
  const tabId = useRef(uid());

  const dispatch = useCallback((a: Action) => rawDispatch(a), []);

  const announce = useCallback((message: string) => {
    // Clear first so repeated identical messages are still read out.
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  const pulse = useCallback((ms = 500) => {
    setBusy((b) => b + 1);
    setTimeout(() => setBusy((b) => b - 1), ms);
  }, []);

  /* ---- Load from storage, connect the cross-tab channel ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SharedState;
        if (saved.version === 1) rawDispatch({ type: "replace", state: { ...saved, typing: [] }, origin: "load" });
      }
    } catch {
      /* storage unavailable — run from seed */
    }

    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL);
      channelRef.current = ch;
      ch.onmessage = (e: MessageEvent) => {
        const data = e.data as { type: string; from: string; state?: SharedState };
        if (data.from === tabId.current || !onlineRef.current) return;
        if (data.type === "hello") {
          ch.postMessage({ type: "state", from: tabId.current, state: stateRef.current });
        } else if (data.type === "state" && data.state && data.state.updatedAt > stateRef.current.updatedAt) {
          rawDispatch({ type: "replace", state: data.state, origin: "remote" });
        }
      };
      ch.postMessage({ type: "hello", from: tabId.current });
    }

    const goOffline = () => setOnlineState(false);
    window.addEventListener("offline", goOffline);
    setReady(true);
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  /* ---- Persist every change; broadcast local changes while online ---- */
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(env.shared));
    } catch {
      /* quota / private mode — ignore */
    }
    if (env.origin === "local" && onlineRef.current && channelRef.current) {
      channelRef.current.postMessage({ type: "state", from: tabId.current, state: env.shared });
      pulse(450);
    }
  }, [env, ready, pulse]);

  /* ---- Scripted replies ---- */
  const deliver = useCallback(
    (author: Person, text: string) => {
      rawDispatch({ type: "send", author, text, status: "sent" });
      const msg = makeMessage(author, text);
      const hint = msg.suggestions.length ? ` Suggestion available: ${msg.suggestions.map((s) => SUGGESTION_LABEL[s.kind]).join(", ")}.` : "";
      announce(`${PEOPLE[author].name}: ${text}.${hint}`);
    },
    [announce],
  );

  const playTurns = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    while (turnQueue.current > 0) {
      turnQueue.current--;
      const idx = stateRef.current.scriptIndex;
      const turn = SCRIPT[idx] ?? [FALLBACK_REPLIES[idx % FALLBACK_REPLIES.length]];
      rawDispatch({ type: "advanceScript" });
      for (const reply of turn) {
        await wait(700);
        rawDispatch({ type: "setTyping", people: [reply.author] });
        await wait(Math.min(900 + reply.text.length * 22, 2600));
        rawDispatch({ type: "setTyping", people: [] });
        if (onlineRef.current) deliver(reply.author, reply.text);
        else heldIncoming.current.push(reply);
      }
    }
    playingRef.current = false;
  }, [deliver]);

  const requestReply = useCallback(() => {
    turnQueue.current = Math.min(turnQueue.current + 1, 2);
    void playTurns();
  }, [playTurns]);

  /* ---- Sending + offline queue ---- */
  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!onlineRef.current) {
        rawDispatch({ type: "send", author: "you", text: trimmed, status: "queued" });
        announce("You're offline. Message queued and will send when you reconnect.");
        return;
      }
      rawDispatch({ type: "send", author: "you", text: trimmed, status: "sent" });
      requestReply();
    },
    [announce, requestReply],
  );

  const flushQueue = useCallback(async () => {
    setBusy((b) => b + 1);
    // Ask other tabs for anything newer before replaying our queue.
    channelRef.current?.postMessage({ type: "hello", from: tabId.current });
    await wait(200);
    const queued = stateRef.current.messages.filter((m) => m.status === "queued");
    for (const m of queued) {
      rawDispatch({ type: "setStatus", id: m.id, status: "sending" });
      await wait(350);
      rawDispatch({ type: "setStatus", id: m.id, status: "sent" });
    }
    // Push our state to other tabs even if nothing was queued.
    channelRef.current?.postMessage({ type: "state", from: tabId.current, state: { ...stateRef.current, updatedAt: Date.now() } });
    await wait(250);
    setBusy((b) => b - 1);

    if (queued.length) announce(`Back online. ${queued.length} queued message${queued.length > 1 ? "s" : ""} sent.`);
    else announce("Back online.");

    const held = heldIncoming.current.splice(0);
    for (const r of held) deliver(r.author, r.text);
    if (queued.length) requestReply();
  }, [announce, deliver, requestReply]);

  const setOnline = useCallback(
    (next: boolean) => {
      if (next === onlineRef.current) return;
      onlineRef.current = next;
      setOnlineState(next);
      if (next) void flushQueue();
      else announce("You're offline. Messages will be queued.");
    },
    [announce, flushQueue],
  );

  const reset = useCallback(() => {
    heldIncoming.current = [];
    turnQueue.current = 0;
    const fresh = { ...createSeedState(), updatedAt: Date.now() };
    rawDispatch({ type: "replace", state: fresh, origin: "remote" });
    channelRef.current?.postMessage({ type: "state", from: tabId.current, state: fresh });
    announce("Demo reset.");
  }, [announce]);

  const syncStatus: SyncStatus = !online ? "offline" : busy > 0 ? "syncing" : "synced";

  const value = useMemo<StoreValue>(
    () => ({ state: env.shared, ready, online, syncStatus, announcement, dispatch, send, setOnline, announce, reset }),
    [env.shared, ready, online, syncStatus, announcement, dispatch, send, setOnline, announce, reset],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
