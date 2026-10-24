/**
 * Normaliza el payload de distintos proveedores de email inbound.
 *
 * Soportados:
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

export async function parseInbound(request: Request): Promise<InboundEmail | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return null;

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
