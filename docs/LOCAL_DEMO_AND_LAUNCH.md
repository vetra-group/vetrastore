# Local demo and launch preparation

The storefront includes a local prototype of enquiries, checkout, notifications and a staff workspace. It demonstrates the workflow without connecting outside services. Deployment has not been performed.

## Enable the local demo

Set this in the uncommitted `.env.local` file:

```dotenv
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ORDER_ENQUIRIES_ENABLED=false
CLOUDINARY_MEDIA_ENABLED=false
```

Use the actual local origin for `NEXT_PUBLIC_SITE_URL` if running on another port. Restart the development server after changing environment values. For a production preview, rebuild and restart because `NEXT_PUBLIC_` values are included in the client build.

```powershell
npm.cmd run dev
```

Thai pages use `/`; English pages use `/en`. Open the demo dashboard directly at `/staff` or `/en/staff`. Demo builds publish noindex metadata and a robots rule disallowing crawling; these rules do not provide authentication or privacy.

### What the prototype does

- Contact, wholesale and checkout enquiries default to shared server storage on a loopback local preview; **This browser only** is available explicitly. Newsletter and mock payment previews remain in browser storage. See [shared operations](SHARED_OPERATIONS.md) for authentication, persistence and mock delivery boundaries.
- Checkout can simulate a non-binding enquiry, payment success or payment failure. It never takes money or collects card details.
- The prototype staff workspace and CMS **Browser demo** option share one browser inbox. CMS opens **Shared inbox** by default with authenticated server records, search, filters, assignment, notes and activity history.
- Notifications show their mock delivery state and attempt count. A user-triggered simulation can succeed or fail; retry affects only that notice and stops after three attempts. No email or message is sent.
- “Add sample data” inserts clearly fictional records only when selected. The initial inbox is empty.
- A checklist item marked “Reviewed in demo” changes the prototype only. It does not confirm a business policy, publish content or activate a service.

Use fictional information such as `customer@example.test`. The prototype `/staff` workspace has no staff authentication. The separate shared CMS inbox uses the configured CMS session and staff roles.

### Where data lives

| Browser storage key | Contents |
| --- | --- |
| `vetra-demo-v1` | Demo requests, notification previews, shipping test rules, stock reservations and launch checklist |
| `vetra-store-v1` | Cart and favourites |

Browser storage is specific to the browser profile and origin. Different ports, browsers and devices have separate browser data. Tabs on the same origin can share updates. The **Shared inbox** uses separate server storage; neither simulation supplies an authenticated customer account.

To reset from the interface, open the demo dashboard (`/staff` or `/en/staff`) and scroll to **Start a fresh demo** / **เริ่มต้นข้อมูลตัวอย่างใหม่**. Select **Reset demo data** / **ล้างข้อมูลตัวอย่าง**, then **Confirm reset** / **ยืนยันล้างข้อมูล**. Cancel keeps all data. Confirmation moves demo requests and notifications to Trash for 30 days and returns checklist items to needs confirmation; the bag and favourites are kept. Success or failure is shown beside the action.

Reset moves requests and their notifications into the browser's 30-day Trash and resets the checklist without changing `vetra-store-v1`. Removing the demo key manually removes its retained Trash too. Clearing all site data also clears the cart and favourites. If browser storage is blocked or full, demo submissions and dashboard updates show an error instead of reporting a saved result; form or note drafts remain available for retry.

Shipping test rules and stock commitments are retained through reset and Trash. Deleting an order is not a stock adjustment. Cancel or refund an applicable mock order to release its allocation; deleting the whole browser demo key clears the complete simulation, including its history.

### Request and order workflow

- Wholesale Contact enquiries collect product, estimated units, business, delivery destination and an optional requested date. Honey's business link prefills its product and selected quantity. The route accepts `subject=wholesale`, `product`, `quantity`, `business`, `destination` and `neededBy` query parameters; both client and server validate the submitted fields.
- Mock orders follow enquiry → awaiting payment → paid → preparing → shipped → delivered. Shipment requires a carrier and tracking reference. Cancellation is available before payment; a paid order can progress to a simulated refund. Invalid transitions are rejected, and staff activity plus notification previews are retained. All payment, refund and delivery steps are simulations.
- A successful retry of a declined mock checkout with identical order details updates that same order. It does not add a second order. Server order enquiries still calculate prices from published catalog data and preserve idempotent retries.
- `/account#requests` and `/en/account#requests` show saved mock order progress from this browser, including tracking and cancellation before payment. This is a local history, not an authenticated customer account or a live carrier feed.
- CMS business settings provide shared shipping, returns and wholesale information. Only owner-confirmed overrides replace the pending default terms. Confirm actual stock, prices, minimums, coverage and dates before treating an enquiry as an order.
- Outside demo mode, accepted contact and order enquiries save pending staff/customer notification entries inside the same database document. Those entries explicitly remain `provider-not-configured`; saving a request never claims that email was delivered. Payment, refund, shipping and notification provider contracts are disabled until implemented with server credentials and verified callbacks.

### Shipping and stock simulation

- The listed Thailand and international bundles have separate THB totals. Each total includes shipping to its selected delivery market. Checkout uses a zero additional shipping fee; Thai delivery needs a five-digit postcode, while an international enquiry needs a destination country. Saved enquiries and demo orders retain their quoted THB total.
- Legacy fictional postcode shipping rules remain available in the staff simulation for historical records. They do not change the current public bundle price or add a fee to new orders.
- Inventory uses published stock only as a starting quantity. Unknown stock remains unknown. Enquiries do not reserve stock. A declined mock payment reserves its units for 15 minutes; a paid order commits them. New payments and expired payment retries check the remaining simulated quantity. A blocked attempt retains its form data.
- Cancellation releases reservations; refunds before shipment release committed units. After shipment, a refund releases units only when staff explicitly confirms the simulated return was received. Trash and its expiry never replenish committed stock. These are test mechanics, not published reservation or return policies.
- The browser ledger demonstrates the workflow on this origin. The shared inbox has a separate transactional simulation ledger. Real operations still need live inventory integration, verified payment callbacks, confirmed delivery coverage and authenticated customer history.

## Try the customer and staff journey

1. Open a honey product link and add a quantity to the cart. Confirm quantities and subtotal at checkout.
2. Submit checkout with fictional contact details. Try enquiry, successful mock payment and failed mock payment separately. A failed payment must remain clearly unsuccessful.
3. Submit a general question and a wholesale question from Contact. Try the newsletter form.
4. Open the demo dashboard on the same origin. Search and filter requests, update a status, save a follow-up note and open an email preview.
5. Reload and check that saved changes remain. Confirm that the cart and demo inbox stay separate.
6. Review launch checklist items. These edits are local tracking only.
7. Repeat the journey in Thai and English at narrow and wide widths, including keyboard navigation and browser zoom.

## Disable demo mode

Before preparing a real deployment, set:

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
```

Rebuild and restart. Confirm that mock checkout controls disappear and that `/staff` and `/en/staff` return 404. The prototype dashboard is also excluded from indexing; this is not an authentication mechanism.

Previously saved demo records remain in that browser's storage until removed. They are not uploaded or migrated to MongoDB when demo mode is disabled.

Outside demo mode, contact and newsletter forms use their existing server APIs. Without a configured database they return a retryable unavailable response and preserve input. Optional checkout enquiries require both MongoDB and `ORDER_ENQUIRIES_ENABLED=true`; they remain non-binding enquiries. Saving an enquiry does not automatically send an email.

### Stripe payment path

Real payment orders are stored separately from enquiries and demo records. Keep `PAYMENTS_ENABLED=false` until the live-payment launch gate below is complete. The technical configuration also requires durable MongoDB CMS storage, a published catalog, `PAYMENT_ACCESS_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the correct `NEXT_PUBLIC_SITE_URL`. Register `/api/payments/webhooks/stripe` as the Stripe webhook endpoint for Checkout Session completed, asynchronous success/failure and expiration events. Use Stripe test credentials and a test webhook before live credentials.

The server recalculates the selected bundle from published database prices, saves a pending THB order, and creates a separate Stripe payment attempt. The customer sees the exact THB charge before leaving for Stripe. Only a verified Stripe webhook can mark the order paid; the return page reads the saved status. For now, online payment is limited to Thai delivery addresses with the included-shipping quote. Other destinations remain THB-priced enquiries until international payment and fulfilment operations are ready. Currency conversions shown to international visitors are display estimates only. Merchant iPay remains disabled until Bangkok Bank supplies its current merchant integration guide and credentials. See [payment requirements](PAYMENTS.md).

**Live-payment launch blocker:** Checking a published stock number is not an atomic reservation. The real payment path has no committed inventory ledger or stock release flow, so concurrent paid orders can oversell. Implement and test server-side reservation, commitment and release before collecting live payments. The CMS Orders view has separate authenticated, read-only groups for paid orders and pending orders needing review. It shows the last saved payment attempt and provider reference but cannot resolve payment outcomes, manage fulfilment or notify staff; elapsed local time is not proof of failed payment. Define staff follow-up and reconciliation, including duplicate successful payment review and official refunds. Complete a Stripe test checkout with signed webhooks, retries and out-of-order events. Keep `PAYMENTS_ENABLED=false` until these checks pass.

## Configuration for connected services

| Configuration | Purpose and current boundary |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The verified public origin for canonical URLs, language alternates and sitemap. Use the staging origin for a staging build and the final origin for production. |
| `NEXT_PUBLIC_DEMO_MODE` | Set true only for the local prototype. Set false for real service testing and production; rebuild after changing it. |
| `SITE_NOINDEX` | Set true on staging to keep noindex metadata and disallow crawling when demo mode is off. Set false only for the approved public launch, then rebuild and verify the indexing output. This is not access control. |
| `MONGODB_URI` | Server-side connection for actual contact, newsletter and order-enquiry persistence. Keep credentials outside the repository. |
| `MONGODB_DB` | Target database name; the code defaults to `vetra_store`. Verify the intended environment before writing data. |
| `ORDER_ENQUIRIES_ENABLED` | Allows the non-binding enquiry path when MongoDB is configured. It does not enable payment collection. |
| `PAYMENTS_ENABLED` | Explicit gate for real payment orders; defaults to false. Do not turn on until atomic inventory reservation/ledger, authenticated staff fulfilment and reconciliation, and the signed webhook test pass. Also requires durable MongoDB CMS storage, a public site origin and an available provider. |
| `PAYMENT_PRIMARY_PROVIDER` | `stripe` until Merchant iPay is approved, fully integrated and production-ready. |
| `PAYMENT_ACCESS_SECRET` | Server-only random secret of at least 32 characters used to authorize deliberate payment retries. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Server-only Stripe credentials. Configure matching test or live values and register the webhook endpoint before enabling payments. |
| `CLOUDINARY_MEDIA_ENABLED` | Optional delivery for the configured bundled media. Keep false until the intended assets are uploaded and verified. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary setup; API key and secret remain server-side. Follow [media setup](MEDIA_SETUP.md). |

Live email delivery remains unconfigured. The Stripe adapter is implemented but stays disabled unless all payment prerequisites are set; Merchant iPay has no technical integration yet. Staff authentication and roles are available through the CMS configuration; configure real staff accounts before deployment. Keep secrets server-side and use separate test and production environments.

## Staged launch checklist

### 1. Confirm the selling details

- Verify current sale stock, product price, label photos, ingredients and lot/best-before information. The supplied sample photos do not establish the condition or date of current stock.
- Confirm shipping rates, coverage and realistic delivery estimates.
- Confirm returns, damaged-product handling and the customer support process.
- Confirm wholesale minimum quantities, prices and quotation terms.
- Verify the business contact details and the information to publish.
- Update shared catalog facts and both language versions only after confirmation. Do not invent stock claims, policies, certifications or delivery promises.

### 2. Connect operational services

- Configure the intended MongoDB environment and test successful persistence, duplicate retries and unavailable-service recovery.
- Connect email notifications; test actual delivery, retry handling and the distinction between saving a request and sending a notification.
- Complete atomic inventory reservation, commitment and release for real orders; a stock-number check and the simulation ledger do not prevent overselling.
- Verify the Stripe test checkout and signed webhook end to end, including authoritative success/failure, retries, duplicates and out-of-order events. Keep `PAYMENTS_ENABLED=false` until the inventory and webhook checks pass. Mock outcomes cannot be reused as production confirmation.
- Assign staff to review the authenticated paid-order view, fulfil orders and reconcile provider payments. Define how to handle duplicate successful charges and official refunds before launch.
- Configure the shared CMS staff accounts and durable operations storage. Define private request retention, deletion and backup processes; the browser prototype is not a production staff workspace.
- Keep bundled media active or complete the documented Cloudinary verification before changing delivery.

### 3. Prepare staging

- Confirm the domain and configure environment values for staging. Keep demo mode off for a real operational test, or label a separate demonstration environment clearly.
- Set `SITE_NOINDEX=true` for staging. For an operational staging build use `NEXT_PUBLIC_DEMO_MODE=false` so connected services are exercised. Rebuild and restart, then check page robots metadata and `/robots.txt`.
- Check equivalent Thai and English routes, redirects, canonical URLs, sitemap and structured data against visible product facts.
- Review performance, keyboard access, focus states, browser zoom, narrow layouts and large available layout space.
- Test the entire customer journey and the actual staff follow-up process with controlled test records.

### 4. Launch only after the checks pass

- Confirm business details, connected services and staff responsibilities with the store owner.
- Run the repository checks, repeat the live staging journey and record any remaining limitations.
- Configure the final domain and production services. Set `NEXT_PUBLIC_DEMO_MODE=false` and, once public indexing is approved, `SITE_NOINDEX=false`. Rebuild, verify the final canonical URLs and robots output, then repeat the relevant checks before publishing.

Preparation does not publish the website or activate outside services. Production deployment remains a separate action.

## Repository checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:payments
npm.cmd run test:demo
npm.cmd run build
```

Start the built preview in a separate terminal, then run the route smoke check against its origin:

```powershell
npm.cmd run start -- -p 3100
```

```powershell
npm.cmd run test:smoke -- http://127.0.0.1:3100
```

Build and route checks are separate from verifying live database writes, delivered email, payment-provider confirmation and authenticated staff access. Record which services and journeys were actually tested.
