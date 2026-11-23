export type Person = "you" | "maya" | "dev";

export type SuggestionStatus = "pending" | "accepted" | "dismissed";

interface SuggestionBase {
  id: string;
  status: SuggestionStatus;
  /** The fragment of the message that triggered the suggestion (highlighted in the bubble). */
  match: string;
  /** Id of the plan item created on accept, so it can be undone. */
  resultId?: string;
}

export interface EventSuggestion extends SuggestionBase {
  kind: "event";
  title: string;
  /** ISO date-time string. */
  start: string;
  allDay: boolean;
}

export interface ChecklistSuggestion extends SuggestionBase {
  kind: "checklist";
  title: string;
  items: string[];
}

export interface SplitSuggestion extends SuggestionBase {
  kind: "split";
  label: string;
  total: number;
  people: number;
}

export type Suggestion = EventSuggestion | ChecklistSuggestion | SplitSuggestion;

/** What detect() returns: a suggestion without app-managed fields. */
export type DetectedSuggestion =
  | Omit<EventSuggestion, "id" | "status" | "resultId">
  | Omit<ChecklistSuggestion, "id" | "status" | "resultId">
  | Omit<SplitSuggestion, "id" | "status" | "resultId">;

export type MessageStatus = "sent" | "queued" | "sending";

export interface Message {
  id: string;
  author: Person;
  text: string;
  ts: number;
  status: MessageStatus;
  suggestions: Suggestion[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  sourceMessageId?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
  sourceMessageId?: string;
}

export interface Cost {
  id: string;
  label: string;
  total: number;
  people: number;
  sourceMessageId?: string;
}

/** An AI offer to add a line to the notes (e.g. after a calendar event is confirmed). */
export interface NotesOffer {
  id: string;
  text: string;
  eventId?: string;
}

/** State shared across tabs (persisted + broadcast). */
export interface SharedState {
  version: number;
  updatedAt: number;
  messages: Message[];
  events: CalendarEvent[];
  checklists: Checklist[];
  costs: Cost[];
  notesHtml: string;
  notesOffers: NotesOffer[];
  /** Original lines whose tighten suggestion was dismissed — never suggest them again. */
  dismissedTightens: string[];
  typing: Person[];
  scriptIndex: number;
}
