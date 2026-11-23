/**
 * The "AI" in this prototype.
 *
 * Both functions are deliberately rule-based so the demo is deterministic and
 * needs no API key. They are the only seam the UI depends on: swapping either
 * for a model call (returning the same shapes) requires no UI changes.
 */
import type { DetectedSuggestion } from "./types";

/* ----------------------------------------------------------------------------
 * detect(): find actionable things in a chat message
 * ------------------------------------------------------------------------- */

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const DAY_RE =
  /\b(?:(this|next)\s+)?(today|tonight|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const TIME_RE = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])|\b(?:at\s+)?(noon|midnight)\b/i;

const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const FILLER_START =
  /^(?:ok(?:ay)?|so|hey|also|and|btw|alright|how about|what about|should we|could we|can we|let'?s(?: do| have| get| plan)?|we could|we should|maybe|i think|i vote|i'?m thinking|do|have|grab|plan on|is everyone ok with|does|on)\b[\s,]*/i;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sentenceContaining(text: string, fragment: string) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  return sentences.find((s) => s.toLowerCase().includes(fragment.toLowerCase())) ?? text;
}

function resolveDay(word: string, now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const w = word.toLowerCase();
  if (w === "today" || w === "tonight") return d;
  if (w === "tomorrow") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  const target = WEEKDAYS.indexOf(w);
  let diff = (target - d.getDay() + 7) % 7;
  if (diff === 0) diff = 7; // "Saturday" said on a Saturday means next one
  d.setDate(d.getDate() + diff);
  return d;
}

function detectEvent(text: string, now: Date): DetectedSuggestion | null {
  const day = text.match(DAY_RE);
  if (!day) return null;

  const sentence = sentenceContaining(text, day[0]);
  const time = sentence.match(TIME_RE);
  const date = resolveDay(day[2], now);
  let allDay = true;

  if (time) {
    allDay = false;
    if (time[4]) {
      date.setHours(time[4].toLowerCase() === "noon" ? 12 : 0, 0);
    } else {
      let h = parseInt(time[1], 10) % 12;
      if (time[3].toLowerCase().startsWith("p")) h += 12;
      date.setHours(h, time[2] ? parseInt(time[2], 10) : 0);
    }
  } else if (day[2].toLowerCase() === "tonight") {
    allDay = false;
    date.setHours(19, 0);
  }

  // Title: the sentence minus the day/time phrases and conversational filler.
  let title = sentence.replace(day[0], " ");
  if (time) title = title.replace(time[0], " ");
  title = title
    .replace(/\b(on|this|next)\s*(?=[\s,?!.]|$)/gi, " ")
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 4; i++) title = title.replace(FILLER_START, "").trim();
  title = title.replace(/^(?:at|for|the)\s+/i, "").replace(/[,;:]+$/g, "").trim();
  const words = title.split(" ").filter(Boolean).slice(0, 6);
  title = words.length ? capitalize(words.join(" ")) : "Plan";

  const match = time && sentence.indexOf(time[0]) > sentence.indexOf(day[0])
    ? sentence.slice(sentence.indexOf(day[0]), sentence.indexOf(time[0]) + time[0].length)
    : day[0];

  return { kind: "event", title, start: date.toISOString(), allDay, match };
}

const LIST_RE =
  /\b(bring|pack(?:ing)?|packing list|groceries|grocery list|shopping(?: list)?|to-?do|todo|need|supplies|snacks)\s*:\s*([^\n]+)/i;
const LIST_INLINE_RE =
  /\b(?:we (?:still )?need|someone (?:should )?(?:bring|grab)|don'?t forget|can someone grab)\s+([^.!?\n]+)/i;

function listTitle(keyword: string) {
  const k = keyword.toLowerCase();
  if (k.startsWith("bring") || k.startsWith("pack") || k === "need" || k === "supplies") return "Packing list";
  if (k.startsWith("groc") || k.startsWith("shop") || k === "snacks") return "Groceries";
  if (k.startsWith("to")) return "To-do";
  return capitalize(k);
}

function splitItems(raw: string) {
  return raw
    .split(/,|;|\band\b|&|\+/i)
    .map((s) => s.trim().replace(/^(?:some|a|an|the|more)\s+/i, "").replace(/[.!?]+$/, "").trim())
    .filter((s) => s.length > 0 && s.length < 40)
    .map(capitalize);
}

function detectChecklist(text: string): DetectedSuggestion | null {
  const m = text.match(LIST_RE);
  if (m) {
    const items = splitItems(m[2]);
    if (items.length >= 2) return { kind: "checklist", title: listTitle(m[1]), items, match: m[0].trim() };
  }
  const inline = text.match(LIST_INLINE_RE);
  if (inline) {
    const items = splitItems(inline[1]);
    if (items.length >= 2) return { kind: "checklist", title: "Packing list", items, match: inline[0].trim() };
  }
  return null;
}

const AMOUNT_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/;
const PEOPLE_RE =
  /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s*(?:of us|people|ppl|persons|ways?)\b|\bsplit\s+(?:it\s+)?(?:between\s+)?(\d+|two|three|four|five|six|seven|eight|nine|ten)(?:\s+ways?)?\b/i;
const LABEL_STOP = /\b(?:is|was|are|were|costs?|comes? to|came to|total(?:s|led)?|will be|=|:|about|around|like|only|just)\s*$/i;

function toNumber(word: string) {
  return NUMBER_WORDS[word.toLowerCase()] ?? parseInt(word, 10);
}

function detectSplit(text: string, groupSize: number): DetectedSuggestion | null {
  const amount = text.match(AMOUNT_RE);
  if (!amount) return null;
  const people = text.match(PEOPLE_RE);
  const mentionsSplit = /\b(split|each|per person|chip in)\b/i.test(text);
  if (!people && !mentionsSplit) return null;

  const total = parseFloat(amount[1].replace(/,/g, "") + (amount[2] ? `.${amount[2]}` : ""));
  const count = people ? toNumber(people[1] ?? people[2]) : groupSize;
  if (!total || !count || count < 2) return null;

  // Label: prefer "$90 for the kayaks", else the words right before the amount.
  const idx = text.indexOf(amount[0]);
  const after = text.slice(idx + amount[0].length);
  const forMatch = after.match(/^\s*(?:total\s+)?for\s+(?:the\s+)?([a-z][a-z' ]{1,30}?)(?=[,.!?]|\s+split|\s+between|\s+and\b|$)/i);
  let label = "";
  if (forMatch) {
    label = forMatch[1];
  } else {
    let before = text.slice(0, idx).split(/[.!?\n]/).pop() ?? "";
    for (let i = 0; i < 3; i++) before = before.replace(LABEL_STOP, "").trim();
    for (let i = 0; i < 4; i++) before = before.replace(FILLER_START, "").trim();
    before = before.replace(/^(?:the|our|my)\s+/i, "");
    label = before.split(" ").slice(-3).join(" ");
  }
  label = capitalize(label.trim()) || "Shared cost";

  const end = people ? Math.max(text.indexOf(people[0]) + people[0].length, idx + amount[0].length) : idx + amount[0].length;
  const match = text.slice(idx, end);
  return { kind: "split", label, total, people: count, match };
}

export interface DetectContext {
  now?: Date;
  /** Head count used when a message says "split" without a number. */
  groupSize?: number;
}

/** Returns zero or more actionable suggestions for a chat message. */
export function detect(text: string, ctx: DetectContext = {}): DetectedSuggestion[] {
  const now = ctx.now ?? new Date();
  const found: DetectedSuggestion[] = [];
  const event = detectEvent(text, now);
  if (event) found.push(event);
  const list = detectChecklist(text);
  if (list) found.push(list);
  const split = detectSplit(text, ctx.groupSize ?? 3);
  if (split) found.push(split);
  return found;
}

/* ----------------------------------------------------------------------------
 * tighten(): suggest a crisper version of a line in the notes
 * ------------------------------------------------------------------------- */

type Rule = [RegExp, string | ((...m: string[]) => string)];

const TIGHTEN_RULES: Rule[] = [
  [/\b(?:i think|i guess|i feel like|honestly|basically|actually|literally|kind of|sort of|kinda|sorta)\b,?\s*/gi, ""],
  [/\b(?:probably|pretty|really|very|just|maybe|perhaps|definitely|super)\s+(?=\w)/gi, ""],
  [/,\s*like,\s*/gi, ", "],
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bat this point in time\b/gi, "now"],
  [/\ba lot of\b/gi, "lots of"],
  [/\bgonna\b/gi, "going to"],
  [/\bwanna\b/gi, "want to"],
  [/\bgotta\b/gi, "have to"],
  [/\b(?:u)\b/g, "you"],
  // "5ish" / "5-ish" -> "5:00 pm" (1–6 read as afternoon, 7–11 as morning)
  [/\b(\d{1,2})\s*-?ish\b/gi, (_m, h) => {
    const n = parseInt(h, 10);
    if (n > 12) return _m;
    return `${n}:00 ${n >= 7 && n <= 11 ? "am" : "pm"}`;
  }],
  [/(?<![:\d])(\d{1,2})\s*(am|pm)\b/gi, (_m, h, ap) => `${h}:00 ${ap.toLowerCase()}`],
];

/**
 * Returns a tightened version of `line`, or null if there's nothing worth
 * suggesting. Pure and synchronous.
 */
export function tighten(line: string): string | null {
  const original = line.trim();
  if (original.length < 12 || original.split(/\s+/).length < 4) return null;

  let s = original;
  for (const [re, rep] of TIGHTEN_RULES) {
    s = s.replace(re, rep as never);
  }
  s = s
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^,\s*/, "")
    .trim();

  // Preserve the original's leading case.
  if (original[0] === original[0].toUpperCase()) s = capitalize(s);

  const changedBody = s.replace(/[.!?]$/, "") !== original.replace(/[.!?]$/, "");
  if (!changedBody) return null;
  if (!/[.!?:]$/.test(s)) s += ".";
  return s;
}
