/**
 * Normaliza el payload de distintos proveedores de email inbound.
 *
 * Soportados:
 * - Resend (`email.received`): se descargan los adjuntos por API.
 * - Postmark (JSON con `Attachments[].Content` en base64)
 * - SendGrid Inbound Parse y Mailgun Routes (multipart/form-data)
 * - JSON genérico para pruebas manuales
 */

export interface InboundAttachment {
  filename: string;
  mimeType: string;
  base64: string;
}

export interface InboundEmail {
  from: string;
  subject: string;
  clientId?: string;
  attachments: InboundAttachment[];
}

function emailAddress(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return (match ? match[1] : value).trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Resend solo manda metadata en el webhook; los adjuntos se descargan con la
 * API usando `RESEND_API_KEY`.
 */
async function parseResend(body: Record<string, unknown>): Promise<InboundEmail | null> {
  const data = asRecord(body.data);
  const emailId = data.email_id ? String(data.email_id) : "";
  if (!emailId) return null;

  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("Falta RESEND_API_KEY para descargar los adjuntos del mail.");
  }

  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments`,
    {
      headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend rechazó la consulta de adjuntos: HTTP ${response.status} ${detail.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
  const attachments: InboundAttachment[] = [];

  for (const item of payload.data ?? []) {
    const downloadUrl = item.download_url ? String(item.download_url) : "";
    if (!downloadUrl) continue;

    const fileResponse = await fetch(downloadUrl, { cache: "no-store" });
    if (!fileResponse.ok) continue;

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    attachments.push({
      filename: String(item.filename ?? "adjunto"),
      mimeType: String(item.content_type ?? "application/octet-stream"),
      base64: buffer.toString("base64"),
    });
  }

  return {
    from: emailAddress(String(data.from ?? "")),
    subject: String(data.subject ?? ""),
    attachments,
  };
}

export async function parseInbound(request: Request): Promise<InboundEmail | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return null;

    // Resend
    if (body.type === "email.received" || asRecord(body.data).email_id) {
      return parseResend(body);
    }

    // Postmark
    if (Array.isArray(body.Attachments)) {
      return {
        from: emailAddress(String(body.From ?? "")),
        subject: String(body.Subject ?? ""),
        attachments: (body.Attachments as unknown[]).map((raw) => {
          const item = asRecord(raw);
          return {
            filename: String(item.Name ?? "adjunto"),
            mimeType: String(item.ContentType ?? "application/octet-stream"),
            base64: String(item.Content ?? ""),
          };
        }),
      };
    }

    // JSON genérico (pruebas)
    if (Array.isArray(body.attachments)) {
      return {
        from: emailAddress(String(body.from ?? "")),
        subject: String(body.subject ?? ""),
        clientId: body.clientId ? String(body.clientId) : undefined,
        attachments: (body.attachments as unknown[]).map((raw) => {
          const item = asRecord(raw);
          return {
            filename: String(item.filename ?? "adjunto"),
            mimeType: String(item.contentType ?? "application/octet-stream"),
            base64: String(item.contentBase64 ?? item.content ?? ""),
          };
        }),
      };
    }

    return null;
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const attachments: InboundAttachment[] = [];

    for (const [, value] of form.entries()) {
      if (value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        attachments.push({
          filename: value.name || "adjunto",
          mimeType: value.type || "application/octet-stream",
          base64: buffer.toString("base64"),
        });
      }
    }

    return {
      from: emailAddress(String(form.get("from") ?? form.get("sender") ?? "")),
      subject: String(form.get("subject") ?? ""),
      clientId: form.get("clientId") ? String(form.get("clientId")) : undefined,
      attachments,
    };
  }

  return null;
}
