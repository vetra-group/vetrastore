# Payment integration handoff

Online payment stays disabled by default. This document records the work that
can be prepared before merchant credentials and the live stock count arrive.
`docs/PAYMENTS.md` remains the launch policy.

## Transaction path

1. The server reads the published catalog, validates the delivery address and
   cart, and calculates the exact THB total. The customer's displayed amount is
   only an expectation check.
2. One MongoDB transaction creates the pending order and reserves its units in
   `payment_inventory`. Each order has one allocation and an immutable inventory
   transition ledger; an identical submission key reuses the saved order.
3. A payment attempt records frozen provider inputs and its own idempotency key.
   An uncertain provider response stays on that attempt. A second provider is
   never selected automatically.
4. A signed provider webhook, or an owner-initiated lookup of an already saved
   provider reference, enters the same transactional order, attempt, event and
   inventory transition. Verified success commits stock. Verified failure or
   expiry releases it. A later or second success is retained and flagged for
   staff review.
5. The return page reads saved order state. A browser redirect never confirms
   payment. Staff can inspect provider references in the authenticated Orders
   view and check a known attempt against the provider.

Real payment inventory is separate from the enquiry and simulation ledgers.
Published CMS stock is the starting confirmed quantity. A later CMS stock edit
pauses new reservations for that product until an owner reconciles the real
balance. The reconciliation requires the current published stock, the explicit
total sellable budget including prior committed orders, a version and a reason;
it never erases prior reservations or paid commitments.

## Provider details to supply

For Bangkok Bank Merchant iPay, obtain the current merchant integration guide
and issued sandbox/live credentials. Confirm the exact initiation endpoint,
request authentication and signing, callback verification, payment lookup,
idempotency behavior, expiry, supported charge and settlement currencies,
refund/void operations, and the merchant's enabled payment methods. Add these
behind the existing `PaymentProvider` interface and verify real signed callbacks
before making it selectable. No Merchant iPay endpoint or signature rule is
assumed here.

The existing Stripe adapter is the staged fallback. Its test credentials and
registered test webhook endpoint must be provided in the intended staging
environment. Local, Vercel Preview and Development require `sk_test_`; Vercel
Production requires `sk_live_` and its matching live webhook secret. A
wrong-mode key disables Stripe, and signed events plus retrieved Sessions must
report the expected mode before a payment can settle. Do not put secrets in the
repository or browser.

## Launch verification

- Confirm physical stock and reconcile each live product's balance. Exercise
  concurrent last-unit orders against a transactional MongoDB deployment.
- Complete a Stripe **test** checkout and signed webhook delivery for paid,
  failed, expired, duplicate and out-of-order events. Test uncertain initiation
  and provider outages without creating a second charge.
- Verify owner and editor access with real staff accounts. Assign staff who will
  reconcile pending attempts, fulfil paid orders, record shipments, review
  unexpected second charges and perform provider-confirmed refunds.
- Keep `PAYMENTS_ENABLED=false` until those checks and the operational handoff
  have passed. International online payment remains unavailable until its
  destination, fulfilment and provider charge path are verified; customers can
  still send an enquiry.
