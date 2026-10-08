# Payments

Use a provider-agnostic payment architecture. Bangkok Bank Merchant iPay is
the intended primary provider, with Stripe available as fallback. Use Stripe
until Merchant iPay is approved, documented for this merchant, configured,
and production-ready; then make Merchant iPay primary while retaining Stripe
as a customer-selectable fallback. Never silently move a failed payment to
another provider.

## Checkout and records

Checkout must validate the cart and recalculate authoritative product prices,
discounts, shipping and totals from server-side database state. Create a
pending order before starting payment. Select an available provider, create a
separate payment-attempt record, then create the provider payment. One order
may have multiple attempts for deliberate retries or provider changes; each
attempt has its own provider reference and idempotency key.

The customer pays at the provider. Verify the callback or webhook using that
provider's official mechanism, update the matching attempt, and mark the
order paid only after verified success for the expected amount and currency.
The return URL may show a pending result but must never confirm payment by
itself. Keep duplicate and out-of-order callbacks idempotent, and reconcile
uncertain outcomes before permitting another attempt. Show the result page
from authoritative order/payment state.

## Live-payment launch gate

Keep `PAYMENTS_ENABLED=false` by default. A confirmed stock number is required
for each product. The real payment path now reserves stock with the pending
order, commits a paid inventory ledger entry, and releases stock after a
verified failure or expiry. Credential-free tests exercise those transitions
with fake transactions; confirm them against the intended MongoDB deployment,
including concurrent last-unit checkouts, before accepting live money. A CMS
stock edit pauses new reservations until an owner reconciles the real balance.
The demo and enquiry ledgers remain separate.

The CMS Orders view separates provider-confirmed paid orders from pending
orders needing review. It shows saved attempts and provider references. Owners
can inspect a known provider reference through the provider's server API and
reconcile real inventory; staff can track preparation and shipment for a paid,
inventory-committed order. A local initiation window ending is not proof that
a provider payment failed. The view does not send staff notifications or issue
refunds, and an unexpected second successful charge stays flagged for official
provider review. Before launch, assign staff ownership for fulfilment,
shipment and reconciliation; test the workflow with real staff accounts and
verify that a second charge is detected, reviewed and refunded through the
provider's official process. Exercise the complete Stripe test checkout and
signed webhook path, including duplicate, out-of-order, failed and uncertain
events. Do not enable live payments until the connected inventory and webhook
tests have passed. See [payment integration handoff](PAYMENT_INTEGRATION_HANDOFF.md).

Keep provider logic behind a shared adapter/interface. Products, cart,
pricing, discounts, shipping, orders, inventory, customers, invoices and CMS
must not depend on provider-specific SDKs, request fields or statuses.
Credentials and signing keys stay server-side. The client cannot set prices,
order totals, payment status or provider confirmation. A provider failure
before payment begins may offer the customer an explicit fallback choice;
do not automatically retry through a second provider.

Use THB as the canonical currency for new orders and payment reconciliation.
Other currencies may be shown as approximate display values unless the chosen
provider officially supports charging that currency and the complete order
and settlement flow has been implemented and verified. Clearly distinguish
display conversions from charge amounts. Preserve historical orders with
their recorded currency and amounts; do not rewrite them during migration.

## Merchant iPay integration boundary

Implement Merchant iPay only from Bangkok Bank's current official integration
documentation and merchant-issued credentials. Confirm its supported
endpoints, request signing, callback verification, DCC behavior, settlement
currencies, refunds and voids before enabling it. Do not infer these details
from other gateways, mock flows or a return URL. Until the provider is fully
verified, keep its adapter disabled and the existing mock/enquiry flows
clearly separate from real payments.
