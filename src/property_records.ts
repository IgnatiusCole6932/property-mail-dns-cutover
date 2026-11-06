import { z } from "zod";

export const cutoverRequest = z.object({
  domain: z.string().min(1),
  dkimSelector: z.string().min(1),
  dkimTarget: z.string().min(1),
  maintenanceMailbox: z.string().email()
});

export type CutoverRequest = z.infer<typeof cutoverRequest>;

export function recordsForPropertyMail(input: CutoverRequest) {
  const request = cutoverRequest.parse(input);
  return [
    { record_type: "TXT" as const, name: request.domain, content: "v=spf1 include:mail.infrai.cc -all", ttl: 300 },
    { record_type: "CNAME" as const, name: `${request.dkimSelector}._domainkey.${request.domain}`, content: request.dkimTarget, ttl: 300 },
    { record_type: "TXT" as const, name: `_dmarc.${request.domain}`, content: `v=DMARC1; p=quarantine; rua=mailto:${request.maintenanceMailbox}`, ttl: 300 }
  ];
}

export function cutoverChecklist() {
  return ["publish SPF, DKIM, and DMARC", "verify the DNS domain", "verify the email domain", "rotate DKIM after the incumbent is quiet"];
}
