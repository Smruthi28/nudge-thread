# Nudge Thread

**AI that suggests inside the conversation.** A concept demo for the Act Frontend Engineer, Web role.
It's an independent concept, not an Act product, and it uses no Act data or systems.

Most products add AI as a chatbot in a side window. Nudge Thread has no chatbot. It reads the
conversation you're already having and quietly suggests the next useful action. You accept with one
tap or dismiss, and nothing happens without your approval.

## Try it (60 seconds)

1. In the chat, accept the **Split cost**, **Create checklist** and **Add to calendar** nudges. The Plan fills in.
2. Change the cabin total or head count in **Costs**. The per-person amount recalculates.
3. Send a message. Maya or Dev types back, and their replies carry new nudges.
4. Turn on **Go offline**, send a message (it's queued), then turn it off. The queue flushes.
5. Open **Trip notes** and pause. The AI suggests a tighter line and offers a "Confirmed:" line for accepted events.
6. Open the app in a second tab. Chat, plan and notes stay in sync.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Deploy: import the repo in Vercel (zero config, it's a standard Next.js app).

## What's real and what's mocked

| | |
|---|---|
| **Real** | Interaction design, state management (one reducer in `lib/store.tsx`), offline queue, cross-tab sync (`BroadcastChannel` + `localStorage`), recalculating cost table, rich-text editor, accessibility (keyboard, live-region announcements, ARIA tabs, reduced motion, light/dark) |
| **Mocked** | The AI is rule-based pattern matching in two functions in `lib/ai.ts`: `detect()` for chat messages and `tighten()` for notes. A model call returning the same shapes would replace them without changing the UI. Maya's and Dev's replies are scripted (`lib/seed.ts`). |
| **Not included** | Accounts, a backend, a database, true multi-user collaboration or conflict resolution. Cross-tab sync is last-change-wins, not a CRDT (queued messages are never dropped on merge). |

## Structure

```
lib/ai.ts            detect() + tighten(): the only "AI" seam
lib/store.tsx        reducer, persistence, cross-tab sync, offline queue, scripted replies, announcer
lib/seed.ts          seed conversation + reply script
components/chat/     thread, message bubbles, inline nudges, composer
components/plan/     calendar, checklists, cost table
components/notes/    contentEditable editor with inline AI edits
components/AppShell  layout, desktop side panel, mobile Chat/Plan tabs
```

Stack: Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide.
