# Smart Cards Ledger — Planned Feature (not yet built)

User wants to build a "WhatsApp-native Smart Cards" system per a product slide: at each of 6 dairy
value-chain stages (CHOW Ready & Dispatch, Feed Production/Fortification, Feed Dispatch to
Distributors, Distribution to Societies, Allocation to Farmers, Emissions Capture & Ledgering),
the system pushes a structured WhatsApp card (e.g. "gramCarbon FlowCard — CHOW Dispatch" showing
Batch ID/Quantity/From/To/Date), the recipient replies Accept/Edit/Reject, and the response is
written to an immutable, audit-ready ledger for MRV/carbon-credit purposes.

## Why this is a gap

Confirmed nothing in the current codebase matches this — searches for "smart card", "FlowCard",
"ledger", "immutable", "Accept/Reject", "CHOW", "fortification", "societies", "manufacturer",
"allocation" all returned zero hits in `app/` and `lib/`. The current bot
(`app/api/webhook/route.ts`) is user-initiated menu navigation, not system-triggered push cards,
and there's no ledger beyond `AuditLog` (which logs admin dashboard actions, not value-chain
transactions).

## Agreed design (paused before implementation, 2026-06-06)

1. **New `SmartCard` model** — ledger entry: `cardType` (6-stage enum), `batchId`, structured
   `fields`, `recipientPhone`/`recipientRole`, `status` (PENDING/ACCEPTED/EDITED/REJECTED),
   `response`, `hash` + `prevHash` chain for append-only immutability (hash computed only on
   resolution, chained off the previously-resolved card).
2. **`lib/smartCards.ts` service** — `sendSmartCard` (renders structured text + 3 WhatsApp
   buttons: Accept/Edit/Reject with ids `sc_accept_<id>` etc.), `resolveSmartCard` (locks the
   record once resolved).
3. **Webhook integration** — detect `sc_*` button-reply ids (need to also capture interactive
   `id`, not just `title`, which the current parser drops); lightweight Edit flow via an
   `AWAITING_EDIT` status + capturing the next free-text reply.
4. **API** — `POST /api/smart-cards` (admin/system trigger, generic across all 6 stages),
   `GET /api/smart-cards` (paginated ledger listing).
5. **UI** — new `/dashboard/ledger` page + Sidebar entry, showing the hash-chained ledger and a
   manual trigger form (since Manufacturer/Society don't have bot users yet).

## How to resume

Pick up at step 1 (SmartCard model). This is the agreed scope/shape — no need to re-derive the
design; the build was paused mid-plan with no code written yet.
