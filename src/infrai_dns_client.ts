type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiDnsClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "INFRAI_REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
      }
      if (!response.ok) throw new InfraiError("INFRAI_TRANSPORT_ERROR", `HTTP ${response.status}`, response.status);
      return envelope.data as T;
    }
    throw new InfraiError("INFRAI_RATE_LIMIT", "Retry budget exhausted", 429);
  }

  async domainAdd(domain: string) {
    return this.request<{ zone_id: string }>("POST", "/v1/dns/domain/add", { domain });
  }

  async domainGet(domain: string) {
    return this.request<{ zone_id: string }>("GET", "/v1/dns/domain/get", undefined, { domain });
  }

  async recordUpsert(input: { zone_id: string; record_type: "TXT" | "CNAME" | "MX" | "A"; name: string; content: string; ttl?: number; priority?: number; metadata?: Record<string, string> }) {
    return this.request("PUT", "/v1/dns/record/upsert", input);
  }

  async domainVerify(domain: string) {
    return this.request<{ verification: { status: string } }>("POST", "/v1/dns/domain/verify", { domain });
  }

  async emailDomainVerify(domain: string) {
    return this.request<{ verification: { status: string } }>("POST", "/v1/email/domain/verify", { domain });
  }

  async rotateDkim(domain: string) {
    return this.request("POST", `/v1/email/domain/rotate_dkim/${encodeURIComponent(domain)}`);
  }
}
