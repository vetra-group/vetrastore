# Shared requests and simulated operations

CMS **Requests**, **Orders**, **Customers** and **Notifications** open the
shared server inbox by default. **Browser demo** remains a separate, explicit
choice when demo mode is enabled. Existing browser records are preserved and
are never silently uploaded.

## Customer to staff

On a loopback local demo, Contact (including structured wholesale) and checkout
enquiries default to **Shared staff inbox**. The form waits for the server save
before showing success. Staff signed into CMS in another browser can read the
same request. A lost response can be retried with the same details and key;
prices and quote snapshots from the first confirmed save remain unchanged.

The `/api/demo/requests` endpoint accepts only validated, consented, nonbinding
enquiries. It requires same-origin JSON on a loopback host, rejects payment
claims, limits request size and rate, and is disabled on Vercel, remote hosts,
non-demo builds and MongoDB CMS mode. It returns only an ID, reference and
enquiry status. All customer and staff details require CMS authentication.

An explicit **This browser only** form option retains the previous local demo.
Mock payment previews and `/account#requests` still use that browser history.
A shared enquiry confirmation does not link to browser account tracking.
Neither path charges money or sends email.

Outside demo mode, existing contact/order APIs continue to save authoritative,
idempotent MongoDB enquiries. **Sync and refresh** imports these into the shared
inbox in batches of 50 per source. Stable source IDs prevent duplicates and
preserve staff edits or archived records. The original source document is
marked imported only after its shared request and outbox entries commit. A
failure can therefore be retried safely. Source prices, including historical
products, are retained. No external message is sent by synchronization.

## Staff workflow

- Search by name, email, reference, message, business or assignee. Filter by
  request type, follow-up status, assignment and archive state; pages contain
  20 entries. Customer context filters requests by normalized email.
- Owners and editors can read requests, assign them, save notes and follow-up
  status, and archive or restore them. Owner-only controls create test records,
  configure simulated shipping, advance orders and simulate notifications.
- Every edit carries the record revision. A stale edit fails without replacing
  another staff member's changes; the open form keeps its input for review.
- Archive is reversible and retains all activity, notices and allocations.
  It is not deletion or a stock adjustment. Browser Trash remains separate.

## Transactional simulation

Orders start as enquiries. Staff can advance them through awaiting payment,
paid, preparing, shipped and delivered; cancellation and refund paths enforce
the same transition rules. Shipment requires a carrier and tracking reference.
These controls always describe simulated outcomes.

Moving to awaiting payment reserves units for 15 minutes. Payment rechecks
availability and commits units once. Expired holds do not block another order.
Cancellation releases reservations; a refund before shipment releases stock.
After shipment, refund only releases stock when staff confirms the simulated
return. Unknown catalog stock remains unknown. This ledger is separate from
published stock and does not publish stock changes or assert real availability.

Owners may add fictional shipping rules by postcode prefix or `*`; defaults
are unconfigured. An enquiry retains the quote that existed when it was saved.
Shared and browser simulation rules are separate. Actual rates, inventory
integration and verified payment/carrier callbacks still need configuration
and service implementation before accepting real paid orders.

Request changes, activity, inventory, notification entries and command receipts
commit together. Repeating the same command key reuses the saved result;
reusing a key for different details is rejected. Two concurrent attempts to
reserve the final units cannot both succeed.

## Durable fake delivery

Each request and order transition creates staff/customer outbox entries.
Owners choose success or failure and explicitly run a simulation. No network
delivery occurs. Attempts are persisted, stop after three failures and show
their mock receipt IDs.

A saved processing attempt is resolved before another attempt is allowed. The
fake provider stores a durable receipt independently of the outbox
acknowledgement. If the process stops after that receipt, retrying the original
command or **Resolve saved attempt** acknowledges that same receipt without
duplicating delivery or increasing its attempt count. There is no background
email worker. A future real provider must implement the same idempotency and
uncertain-outcome lookup behavior; changing environment values cannot enable it.

## Storage and recovery

- Local CMS uses `operations.json` beside CMS data, with a separate
  `operations.lock`, a five-second bounded wait and atomic file replacement.
  The data file is capped at 24 MiB. A malformed store is preserved and produces
  an error. A crash may leave a lock; stop writers and inspect it before manual
  removal. The application never guesses that another writer is dead.
- Configured MongoDB CMS uses `vetra_operations_requests`, `inventory`,
  `outbox`, `settings`, `commands` and `deliveries` collections (each has the
  `vetra_operations_` prefix), majority/snapshot transactions and indexed inbox
  queries. MongoDB must support transactions, such as a replica set/Atlas.
  There is no process-memory or local-file fallback if durable storage fails.
- Operations contain private enquiry information. CMS content/media backups
  do not include this separate store. Back up the local file or these MongoDB
  collections as part of operational recovery; agree retention rules before
  collecting real customer data. No automatic purge is implemented.

## Verification

Run `node scripts/check-operations.mjs`. It uses isolated local files,
synthetic staff/customer identities, a mocked MongoDB adapter and no external
transport. It covers concurrency, rollback, stale revisions, authorization,
idempotency, historical ingestion, payment/stock transitions, notification
recovery and public enquiry to authenticated inbox persistence.

For browser QA, use an isolated local CMS directory and fictional details:
submit Contact to shared storage, open CMS in another browser session, search
the reference, save assignment/notes, then simulate and resolve a notification.
Also verify offline/error input retention and narrow layouts in all three languages.
