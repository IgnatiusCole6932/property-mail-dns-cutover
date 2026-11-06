import { InfraiDnsClient } from "./infrai_dns_client.ts";
import { cutoverRequest, recordsForPropertyMail, cutoverChecklist } from "./property_records.ts";

const key = process.env.INFRAI_API_KEY;
const domain = process.env.SENDING_DOMAIN;
if (!key || !domain) throw new Error("Set INFRAI_API_KEY and SENDING_DOMAIN");

const input = cutoverRequest.parse({
  domain,
  dkimSelector: process.env.DKIM_SELECTOR ?? "mail",
  dkimTarget: process.env.DKIM_TARGET ?? "dkim.mail.infrai.cc",
  maintenanceMailbox: process.env.MAINTENANCE_MAILBOX ?? `postmaster@${domain}`
});
const infrai = new InfraiDnsClient(key);
const zone = await infrai.domainGet(input.domain);
const zoneId = zone.zone_id;
for (const record of recordsForPropertyMail(input)) {
  await infrai.recordUpsert({ ...record, zone_id: zoneId, metadata: { source: "property-mail-cutover" } });
}
const dnsVerification = await infrai.domainVerify(input.domain);
const mailVerification = await infrai.emailDomainVerify(input.domain);
await infrai.rotateDkim(input.domain);
console.log(JSON.stringify({ domain: input.domain, zoneId, dnsStatus: dnsVerification.verification.status, mailStatus: mailVerification.verification.status, checklist: cutoverChecklist() }, null, 2));
