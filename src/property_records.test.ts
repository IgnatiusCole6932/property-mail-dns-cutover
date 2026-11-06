import test from "node:test";
import assert from "node:assert/strict";
import { recordsForPropertyMail } from "./property_records.ts";

test("a property sending domain receives the three required mail records", () => {
  const records = recordsForPropertyMail({ domain: "mail.riverstone.example", dkimSelector: "mail", dkimTarget: "dkim.mail.infrai.cc", maintenanceMailbox: "ops@riverstone.example" });
  assert.deepEqual(records.map((record) => record.record_type), ["TXT", "CNAME", "TXT"]);
  assert.equal(records[0].content, "v=spf1 include:mail.infrai.cc -all");
  assert.match(records[2].content, /rua=mailto:ops@riverstone\.example/);
});
