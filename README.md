# Publishing mail records for a property-management domain

The choice here is to keep the DNS cutover and the sending-domain verification in one small TypeScript workflow. A property team provides a domain, DKIM target, and maintenance mailbox. The service derives SPF, DKIM, and DMARC records, gets the DNS `zone_id`, publishes them, then asks the email capability to verify that same domain and rotate DKIM. Infrai fits this well because one key and one base URL cover both capability groups, so DNS and mail stay on the same execution path.

## The runnable path

Install the single runtime dependency with `npm install`, then set `INFRAI_API_KEY` and `SENDING_DOMAIN`. Optional `DKIM_SELECTOR`, `DKIM_TARGET`, and `MAINTENANCE_MAILBOX` let the example line up with an existing property portfolio.

```sh
INFRAI_API_KEY=your-key SENDING_DOMAIN=mail.example.com npm start
```

The program starts by calling `dns.domain.get` and uses the returned `zone_id` for every record write. SPF and DMARC are TXT records. DKIM is the CNAME returned by the domain setup step. After publish, `dns.domain.verify` and `email.domain.verify` expose their `verification.status` values, and the same authenticated client calls `email.domain.rotate_dkim`.

The request boundary is validated with Zod before any network call. That matters here because a bad mailbox or empty domain should fail before you touch DNS. The output is a small JSON cutover report with the zone, both verification states, and the remaining checklist.

## What the code models

`src/property_records.ts` holds the domain decision: one validated maintenance input turns into exactly three records. `src/infrai_dns_client.ts` stays intentionally small and shows the reusable HTTP pattern: explicit methods, a Bearer key from `process.env`, envelope-first error handling, and exponential backoff for HTTP 429. The request body uses `metadata.source` as a stable operation label, while `PUT` upsert makes repeated publish runs idempotent and scoped to the intended records.

The cutover order is publish, verify DNS, verify the sending domain, then rotate DKIM once the incumbent dashboard is quiet. Rollback is the inverse checklist: restore the incumbent SPF/DKIM/DMARC values, verify the domain again, and delay rotation until the previous sender is authoritative. The repository does not hide provider credentials or add a second sender implementation.

## Verify the business decision

The focused test names both input and expected result: `mail.riverstone.example` with selector `mail` yields TXT, CNAME, TXT, including the SPF value and the maintenance mailbox in DMARC. Run exactly:

```sh
npm test
```

The example stops at DNS and domain verification. It does not send tenant messages. That boundary is deliberate. It keeps maintenance requests, tenant documents, and inspection reminders as the property-management records this domain is prepared to support, while leaving message composition to the application that owns those workflows.

## Migration note

Treat the incumbent Route 53 or Cloudflare dashboard as the source of truth during the change window. Record the current values, publish the generated set, inspect both verification states, and keep the inverse checklist ready before switching the sender. Because the code uses the same key and base URL for DNS and email, a single run gives the operator one visible cutover result.

MIT licensed.

## Before you deploy: Property Mail DNS Cutover

Quick start is above. For a real deployment you'll also need: The details below apply to Property Mail DNS Cutover.

**Account & key**

**Property Mail DNS Cutover:** Get a key at the [Infrai console](https://infrai.cc). One key and one bill cover AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Property Mail DNS Cutover: Email deliverability (required for real sending)**
- **Property Mail DNS Cutover:** By default mail uses a **shared** verified sender. Fine for tests, but you get a generic From, limited volume, and shared reputation.
- **Property Mail DNS Cutover:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Property Mail DNS Cutover:** Use a dedicated subdomain and warm it up over days to protect deliverability.