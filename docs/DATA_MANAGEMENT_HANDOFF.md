# MongoDB and Cloudinary data management handoff

This project has MongoDB and Cloudinary adapters, but the current local preview
does not prove a connected provider workflow. Keep staging and production in
separate MongoDB databases and separate `CMS_CLOUDINARY_FOLDER` namespaces.
Keep credentials in server-side environment settings. Use a transaction-capable
MongoDB deployment, such as a replica set, for CMS and payment writes.

## Know what is stored where

| Data | Storage | Recovery boundary |
| --- | --- | --- |
| CMS drafts, published content, history, Trash, upload tracking and audit | `cms_files` and private Cloudinary CMS images | CMS complete backup or resumable folder backup includes uploaded image bytes. Restore prepares a draft; it does not publish over the live storefront. |
| CMS write locks and staff access | `cms_locks`, `cms_sessions`, `cms_login_limits` | Recreate staff credentials and sessions separately. Only sessions and login counters have expiry indexes; do not give content, media, history or payment records a blanket TTL. |
| Contact and order enquiries, newsletter signups | `contact_inquiries`, `order_enquiries`, `newsletter_subscribers` | Include in a database backup. They are outside the CMS content archive. |
| Staff request and simulated delivery workflows | `vetra_operations_requests`, `vetra_operations_inventory`, `vetra_operations_outbox`, `vetra_operations_settings`, `vetra_operations_commands`, `vetra_operations_deliveries` | Include in the same database backup. The CMS content archive does not contain these collections. |
| Real payment orders, attempts, events, inventory and fulfilment | `payment_orders`, `payment_attempts`, `payment_events`, `payment_inventory`, `payment_inventory_allocations`, `payment_inventory_ledger`, `payment_fulfilments` | Preserve together in a consistent database backup. These records are separate from the CMS archive and from simulated operations. Keep live payments disabled until connected tests pass. |
| Bundled storefront images | `public/images` in the application source; optional separate public Cloudinary delivery | Keep the application/source backup. `scripts/cloudinary-media.mjs` handles these assets separately from private CMS uploads. |

The CMS archive excludes credentials and staff sessions. A database backup does
not by itself contain Cloudinary image bytes. For disaster recovery, retain
both an independent MongoDB backup and an independent Cloudinary media backup,
plus the application/source version that produced them. Decide retention,
access, encryption and deletion rules before collecting real customer data.

## Staging sequence once access is supplied

1. Configure a **separate staging** database, private Cloudinary folder,
   password-based staff accounts and staging URL. Keep `SITE_NOINDEX=true`,
   `PAYMENTS_ENABLED=false` and public asset delivery disabled until verified.
2. Run `npm run test:data` for credential-free planner and transport checks,
   then `npm run check:launch` for configuration presence. Neither command
   connects to a provider or certifies credentials. Inspect the CMS launch and
   data management panels as an owner. Then run the read-only MongoDB inspection:

   ```powershell
   node scripts/mongodb-management.mjs --inspect
   ```

   Review its transaction-capable topology, bounded CMS file metadata summary,
   exact target fingerprint and index plan. Metadata checks do not read image
   bytes or prove that a backup can be restored. If the two CMS session/login
   expiry indexes need creation, apply only the freshly inspected plan in the
   intended environment, then inspect again:

   ```powershell
   node scripts/mongodb-management.mjs --apply --expected-plan <current-plan-hash>
   node scripts/mongodb-management.mjs --inspect
   ```

   Apply creates only `expiresAt` TTL indexes on `cms_sessions` and
   `cms_login_limits`. It does not delete data or modify content/payment indexes.
3. Save an independent complete CMS backup from the existing store. Inspect it
   before restoring to staging. Use the resumable folder transfer for large
   archives. Keep a separate copy of the source `public/images` assets.
4. Restore the CMS archive **as a draft** in staging. Check record counts,
   checksum errors, galleries, inline images, all three languages, Trash,
   history and old URL redirects. Preview, review and publish only after those
   checks pass. Do not import a local demo browser's order simulation as a
   confirmed sale.
5. Exercise a newly prepared image through browser preparation, submit, private
   upload, database save, public rendering, backup and restore. Interrupt an
   upload and a save separately. Confirm retries reuse the submission and that
   manual Cleanup removes only proven unreferenced uploads.
6. Rehearse MongoDB failure and recovery, concurrent CMS edits, request and
   payment persistence, a provider-native database restore, and a matching
   Cloudinary media restore in an isolated environment. Check real staff
   authorization and hosting request/transfer limits. Record the actual
   environment and results before enabling any live gate.

Use the exact migration, backup and media instructions in
[production setup](PRODUCTION_SETUP.md), [CMS publishing and recovery](CMS_PUBLISHING.md),
[Cloudinary media setup](MEDIA_SETUP.md) and [payment handoff](PAYMENT_INTEGRATION_HANDOFF.md).
Never run a restore or destructive cleanup against production as a rehearsal.

## Inputs still needed

- Staging and production MongoDB connection details, database names, backup
  method and transaction support.
- Cloudinary cloud name, server-side API key/secret, account region, separate
  CMS folders and provider backup/export access. If the account uses an EU or
  AP API endpoint, confirm it before adapting the current CMS provider URL.
- Staging and production site origins, owner/editor accounts, and the agreed
  retention and recovery targets for customer, enquiry and payment data.

Do not commit secrets or put them in `NEXT_PUBLIC_*` variables. The current
credential-free tests use local or mocked storage; connected database/media
verification remains a launch requirement.
