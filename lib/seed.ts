import { detect } from "./ai";
import type { Message, Person, SharedState } from "./types";
import { uid } from "./format";

export const PEOPLE: Record<Person, { name: string; initials: string }> = {
  you: { name: "You", initials: "You" },
  maya: { name: "Maya", initials: "M" },
  dev: { name: "Dev", initials: "D" },
};

export const GROUP_SIZE = 3;

export function makeMessage(author: Person, text: string, ts = Date.now(), status: Message["status"] = "sent"): Message {
  return {
    id: uid(),
    author,
    text,
    ts,
    status,
    suggestions: detect(text, { groupSize: GROUP_SIZE }).map((s) => ({ ...s, id: uid(), status: "pending" as const })),
  };
}

const SEED_MESSAGES: [Person, string, number][] = [
  ["maya", "Ok the lake house is officially booked!! 🏕️", 52],
  ["dev", "Let's go. Cabin is $480 total, 3 of us", 49],
  ["you", "Perfect, I can drive. What do we need?", 44],
  ["maya", "Bring: chairs, ice, speakers, sunscreen", 41],
  ["dev", "Dinner Saturday at 7pm at the dock place? They do fish tacos", 36],
];

export const SEED_NOTES = [
  "<p><b>Lake weekend</b> — Pine Lake cabin</p>",
  "<ul><li>Dev is bringing the cooler</li><li>Check-in code arrives Friday morning</li></ul>",
  "<p>we should probably leave pretty early, maybe around 5ish</p>",
].join("");

export function createSeedState(): SharedState {
  const now = Date.now();
  return {
    version: 1,
    updatedAt: 0,
    messages: SEED_MESSAGES.map(([who, text, minsAgo]) => makeMessage(who, text, now - minsAgo * 60_000)),
    events: [],
    checklists: [],
    costs: [],
    notesHtml: SEED_NOTES,
    notesOffers: [],
    dismissedTightens: [],
    typing: [],
    scriptIndex: 0,
  };
}

/**
 * Scripted replies. One "turn" plays after each message you send.
 * Several contain things detect() picks up, so the demo keeps producing nudges.
 */
export const SCRIPT: { author: Person; text: string }[][] = [
  [{ author: "maya", text: "Yesss. Hike Sunday at 9am? The trailhead is 20 min from the cabin" }],
  [
    { author: "dev", text: "I'm in. Groceries: burgers, buns, corn, s'mores stuff" },
    { author: "maya", text: "Don't forget the marshmallows 😤" },
  ],
  [{ author: "maya", text: "Kayak rental is $90, split 3 ways. I'll book it" }],
  [{ author: "dev", text: "Bonfire Friday at 9pm then. I'll bring the firewood 🔥" }],
];

export const FALLBACK_REPLIES: { author: Person; text: string }[] = [
  { author: "maya", text: "Love that" },
  { author: "dev", text: "Works for me 👍" },
  { author: "maya", text: "Haha yes" },
  { author: "dev", text: "Adding it to the plan" },
  { author: "maya", text: "Can't wait 🌲" },
];
