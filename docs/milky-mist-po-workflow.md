# Milky Mist — Purchase Order (PO) Workflow

Applies to the **Milky Mist D2B** model: CH4OW is supplied to Milky Mist (MM), who mix it with feed and distribute to farmers directly or via distributor societies. PO handling is the coordination layer between ZE (ZeroEarth) Admin/Production/Accounts and MM Production/Accounts, driven by WhatsApp and in-app notifications.

## Status enum

`lib/models/PurchaseOrder.ts` — `PurchaseOrderStatus`:

```
REQUESTED → RECEIVED → ACKNOWLEDGED → MM_ACK_PENDING → PRODUCTION_STARTED
→ PRODUCTION_IN_PROGRESS → PRODUCTION_COMPLETED → QAQC_REQUESTED → QAQC_READY
→ WEIGHT_REQUESTED → WEIGHBRIDGE_READY → WEIGHBRIDGE_PAID → DISPATCHED
→ INVOICE_APPROVED → PAYMENT_REQUESTED → PAYMENT_DONE
```

Default status on creation: `REQUESTED`. A separate `ProductionStatus` enum (`STARTED | IN_PROGRESS | COMPLETED`) tracks the production sub-state.

Every transition is appended to `stageHistory: [{ stage, at }]` via the `pushStage` helper in `lib/poWorkflow.ts`.

## Stages

### 1. Creation — `POST /api/po`
- Role: `SUPER_ADMIN` / `ZE_ADMIN`.
- Multipart form: poNumber, client, batch, qty, rate, amount, notes, optional file.
- If a file is attached at creation: uploads to S3 (`purchase-orders` prefix), status jumps straight to `RECEIVED`, `receivedAt` set, `finalValues` populated if rate/amount given. Otherwise stays `REQUESTED`.
- Audit log: `PO_CREATED`.
- WhatsApp plain text broadcast (no buttons) to ZE Production, MM Production, MM Accounts contacts (`BusinessContact`).

### 2. Document upload — `POST /api/po/[id]/upload`
- Role: `SUPER_ADMIN` / `ZE_ADMIN`. UI shows "Upload Document" only when `status === 'REQUESTED'`.
- Uploads file to S3, sets `fileKey/fileUrl/fileName`, status → `RECEIVED`, `receivedAt` set.
- Audit log: `PO_RECEIVED`.
- WhatsApp plain text broadcast to ZE Prod, MM Prod, MM Acc.

### 3. Acknowledge / finalize values — `POST /api/po/[id]/acknowledge`
- Role: ZE Admin. Only allowed when `status === 'RECEIVED'`.
- ZE Admin enters final qty/rate/amount via modal → merged into `finalValues`, status → `ACKNOWLEDGED`, `acknowledgedAt` set.
- Audit log: `PO_ACKNOWLEDGED`.
- `notifyMmForAcknowledge(order)`: sends WhatsApp **interactive buttons** ("Acknowledge" / "Incorrect", ids `mm_ack_<id>` / `mm_reject_<id>`) to MM Production and MM Accounts, then `pushStage → MM_ACK_PENDING`.

### 4. MM responds — WhatsApp webhook (`app/api/webhook/route.ts` → `handlePoWorkflowButton`)
- **`mm_ack_<id>`** → `notifyZeProdStartProduction(order)`: idempotency-guarded (only fires while still `MM_ACK_PENDING`, so whichever of MM Prod/Acc taps first wins, the second tap is ignored and logged). Sets `mmAcknowledgedAt`, sends WhatsApp text to ZE Production to start production, `pushStage → PRODUCTION_STARTED`.
- **`mm_reject_<id>`** → `handleMmRejection(order)`: same idempotency guard. Creates in-app notification `PO_ACK_REJECTED` (`notifyPoAckRejected`), reverts status via `pushStage → RECEIVED` so ZE Admin must correct and re-acknowledge (loops back to stage 3).
- Any handler error → `notifySystemError('po-workflow-webhook', ...)`.

### 5. Production tracking (daily poll)
- `pollZeProdStatus` sends WhatsApp buttons to ZE Production (`zeprod_status_started_/inprogress_/completed_`), sets `lastStatusPollAt`.
- On tap: `recordProductionStatus` sets `productionStatus` (status → `PRODUCTION_IN_PROGRESS` on IN_PROGRESS) and `relayProductionStatusToMm` texts MM Prod/Acc.
- On `completed`: `handleProductionCompleted` — broadcasts to ZE Accounts requesting QAQC, creates in-app notifications `QAQC_REQUESTED` + `APPROVAL_REQUESTED`, generates 4 documents (QAQC, DN, Invoice, E-Way Bill via `generateDocsResilient`/`lib/docGen.ts`, each retried independently so one S3 failure doesn't block the rest — failures reported via `notifySystemError`), `pushStage → QAQC_REQUESTED`.

### 6. QAQC → Weighbridge → Dispatch → Invoice → Payment
- `pollQaqcReady` / `zeprod_qaqc_ready_` → `handleQaqcReady`: sends DN/Invoice/QAQC doc links to MM, `pushStage → QAQC_READY`, then immediately requests weight from ZE Prod/Acc, `pushStage → WEIGHT_REQUESTED`.
- `pollWeighBridgeReady` / `zeprod_wb_ready_` → `handleWeighBridgeReady`: generates weighbridge doc, `pushStage → WEIGHBRIDGE_READY`, sends buttons to ZE Accounts to confirm payment (`zeacc_wb_paid_`).
- `zeacc_wb_paid_` → `handleWeighBridgePaid`: sets `weighBridgePaidAt`, sends "CH4OW Loaded & Dispatched" text with DN/E-Way Bill to MM Prod and Invoice to MM Acc, `pushStage → DISPATCHED`; then `sendApprovedInvoice` (`pushStage → INVOICE_APPROVED`); then `requestPayment` (`pushStage → PAYMENT_REQUESTED`, sets `paymentRequestedAt`).
- `PAYMENT_DONE` exists in the enum but has no wired handler/route yet — appears to be a manual or future step.

## Notification channels

- **WhatsApp** (`lib/whatsapp.ts`, `sendWhatsAppText` / `sendWhatsAppButtons`): broadcast to `BusinessContact` records filtered by org (`MILKY_MIST` / `ZEROEARTH`) and department (`PRODUCTION` / `ACCOUNTS`). All sends route through `broadcastText` / `broadcastButtons` in `lib/poWorkflow.ts`, using `Promise.allSettled` so one failed contact doesn't block others; failures reported via `notifyWhatsAppFailed`.
- **In-app** (`lib/notifications.ts`, `Notification` model): dashboard-bell notifications for `QAQC_REQUESTED`, `APPROVAL_REQUESTED`, `PO_ACK_REJECTED`, `WHATSAPP_DELIVERY_FAILED`, `SYSTEM_ERROR`.

## Key files

- Model: `lib/models/PurchaseOrder.ts`
- Workflow logic: `lib/poWorkflow.ts`
- Notifications: `lib/notifications.ts`, `lib/whatsapp.ts`
- Document generation: `lib/docGen.ts`
- API routes: `app/api/po/route.ts`, `app/api/po/[id]/upload/route.ts`, `app/api/po/[id]/acknowledge/route.ts`
- Webhook (button handling): `app/api/webhook/route.ts`
- UI: PO page/component (status labels + upload button)
