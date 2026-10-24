# GestionaT

Software de gestión con IA para estudios contables, gestorías y empresas de alto volumen de
facturación. La IA lee la factura, la interpreta, traduce los ítems, entiende el negocio del
cliente y la deja lista para que el administrativo solo tenga que dar el ok.

La pantalla de revisión está construida con [v0](https://v0.app/chat/projects/prj_4QuvqSYHMWDAbgxpyhCUgBimfQSm)
y el motor de extracción y validación vive en este repo.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + componentes de v0/shadcn
- **Google Gemini** (`gemini-2.5-flash`) u **OpenAI** (`gpt-4.1-mini`) con salida estructurada
- Deploy en **Vercel**

## Cómo correr

Requiere **Node 18.18+** (probado con Node 22) y **pnpm**.

```bash
pnpm install
cp .env.example .env.local   # completá la API key
pnpm dev
```

Abrí http://localhost:3000.

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `AI_PROVIDER` | `gemini` u `openai`. Si se omite, se detecta por la key presente. |
| `GEMINI_API_KEY` | API key de Google AI Studio (recomendado: tier gratuito y lectura nativa de PDF). |
| `GEMINI_MODEL` | Default `gemini-2.5-flash`. |
| `OPENAI_API_KEY` | Alternativa. |
| `OPENAI_MODEL` | Default `gpt-4.1-mini`. |

`GET /api/health` indica qué proveedor está activo.

## Flujo

1. Elegís la empresa (perfil de cliente con rubro y plan de cuentas).
2. Subís una o varias facturas (PDF, PNG, JPG, WEBP, HTML o TXT; hasta 4 MB cada una).
3. La cola las procesa **de a una**: extracción con IA, normalización y validación contable.
4. Cada factura queda con semáforo: verde (lista), ámbar (revisar), rojo (error).
5. Revisás y corregís los campos, y aprobás.
6. Exportás cabecera + detalle a **XML** (acción principal) o a CSV.

## Arquitectura

El diseño completo está en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

| Archivo | Rol |
| --- | --- |
| `lib/ai/schema.ts` | Esquema canónico de extracción + traducción al dialecto de Gemini. |
| `lib/html.ts` | HTML a texto plano para el modelo y escape para el visor. |
| `lib/file-kind.ts` | Clasificación de archivos por MIME/extensión (PDF, imagen, HTML, TXT). |
| `lib/ai/prompt.ts` | Prompt contable argentino y contexto de negocio del cliente. |
| `lib/ai/normalize.ts` | Coerción de tipos: importes `1.234,56`, fechas `DD/MM/AAAA`, confianza. |
| `lib/validate.ts` | Reglas de control (isomórficas: servidor y cliente). |
| `lib/clients.ts` | Perfiles de cliente con plan de cuentas. |
| `lib/use-invoice-queue.ts` | Cola secuencial, estado por factura y persistencia de aprobadas. |
| `app/api/invoices/route.ts` | Listado de facturas guardadas, con filtro incremental `since`. |
| `lib/ui-mapping.ts` | Traducción del modelo del motor al modelo de la pantalla. |
| `lib/export-csv.ts` | Exportación cabecera/detalle para sistemas contables. |
| `app/api/extract/route.ts` | Endpoint de extracción. |

## Contrato de API

### `POST /api/extract`

`multipart/form-data`:

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `file` | File | PDF, PNG, JPG o WEBP. Máx. 4 MB. |
| `clientId` | string | Id del perfil de cliente (`GET /api/clients`). |
| `known` | string (JSON) | Opcional. Claves de comprobantes ya aprobados, para detectar duplicados. |

Respuesta `200`:

```json
{
  "ok": true,
  "invoice": { "tipoComprobante": "Factura A", "total": 2987.64, "...": "..." },
  "issues": [{ "code": "total_no_coincide", "message": "...", "severity": "error" }],
  "meta": { "provider": "gemini", "model": "gemini-2.5-flash", "durationMs": 4200 }
}
```

Errores: `{ "ok": false, "code": "...", "error": "..." }` con status `400`, `413`, `415`,
`502` o `503` (falta API key).

### `POST /api/outputs`

Genera el lote de salida a partir de las facturas revisadas.

```json
{
  "clientId": "metalurgica-aconcagua",
  "invoices": [{ "tipoComprobante": "Factura A", "total": 2987.64, "items": [] }]
}
```

Respuesta `200`:

```json
{
  "ok": true,
  "batch": { "id": "lote-...", "facturas": [], "metricas": {} },
  "csv": "tipo_fila,lote,...",
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><lote ...>"
}
```

El XML es un formato **neutro** (no AFIP): `lote` → `factura` → `emisor`/`receptor` →
`lineas` → `linea`, con importes en pesos y la cotización usada. Sirve para importar en un
sistema contable o como respaldo del lote. Cada adaptador específico puede mapear el mismo
`OutputBatch` a su esquema.

### `GET /api/clients`

Perfiles de cliente con su plan de cuentas.

### `GET /api/health`

Proveedor y modelo de IA activos.

## Facturas del exterior

El motor distingue `origen: "local"` (comprobante AFIP) de `origen: "exterior"`
(proveedor fuera de Argentina). En los comprobantes del exterior:

- No se exige CUIT ni CAE; se usa el identificador fiscal tal como figura (VAT, NIF, EIN).
- Se exige cotización si la moneda no es ARS.
- Se agrega un aviso informativo, sin bloquear la aprobación.

La pantalla arranca con un **lote de demostración** de 6 facturas ficticias (5 del exterior y
1 local) para mostrar ambos caminos. No tienen archivo asociado: son filas ya interpretadas.

## Ingesta por mail

`POST /api/inbound/email` recibe el webhook de un proveedor de email inbound, procesa los
adjuntos con el mismo motor y guarda el resultado. La pantalla los muestra al abrirse.

**Proveedores soportados** (el payload se normaliza en `lib/inbound/parse.ts`):

- Postmark Inbound (JSON con adjuntos en base64).
- SendGrid Inbound Parse y Mailgun Routes (multipart/form-data).
- JSON genérico para pruebas manuales.

**Variables**

| Variable | Descripción |
| --- | --- |
| `INBOUND_SECRET` | Si está, exige `?secret=` o el header `x-inbound-secret`. |
| `INBOUND_ALLOWED_DOMAINS` | Dominios de remitente permitidos, separados por coma. |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo servidor). |

Sin Supabase, las facturas se guardan en memoria del proceso (sirve para desarrollo, no
para producción). Tabla esperada:

```sql
create table invoices (
  id text primary key,
  recibido_en timestamptz not null default now(),
  origen text not null,
  remitente text,
  asunto text,
  file_name text,
  client_id text,
  invoice jsonb not null,
  issues jsonb not null,
  provider text,
  model text,
  duration_ms int
);
```

**Prueba manual**

Con el servidor corriendo, simulá un mail con un PDF de muestra y mirá cómo aparece en vivo:

```bash
pnpm inbound samples/factura-a-aceros.pdf
pnpm inbound samples/factura-a-aceros.pdf --from proveedor@ejemplo.com
```

También podés usar `curl` directamente:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"proveedor@ejemplo.com\",\"subject\":\"Factura\",\"attachments\":[{\"filename\":\"f.pdf\",\"contentType\":\"application/pdf\",\"contentBase64\":\"<base64>\"}]}"
```

`GET /api/invoices` devuelve las facturas guardadas y el backend activo. Acepta
`?since=<ISO>` para traer solo las recibidas desde ese momento.

### Facturas en HTML

Se aceptan comprobantes HTML (adjunto o cuerpo del mail) y también TXT. El motor no
renderiza el HTML: extrae el texto visible (`lib/html.ts`), lo manda al modelo y guarda el
HTML original para el visor. El visor lo muestra en un `iframe` con `sandbox` para que no
ejecute scripts.

Limitación: si la factura está embebida como **imagen** dentro del HTML, el texto no alcanza.
En ese caso hay que subir el PDF o la imagen.

```bash
pnpm inbound factura.html            # adjunto HTML
pnpm inbound factura.html --body     # HTML en el cuerpo del mail
```

### Actualización en vivo

La pantalla consulta `/api/invoices` cada 4 segundos (y al volver a la pestaña) usando
`since` con la fecha de la última factura vista. Cuando entra una factura nueva por mail:

- aparece arriba de la tabla, resaltada y con la etiqueta **Nueva** durante unos segundos;
- se muestra un aviso con el proveedor y el remitente (al hacer clic se abre el detalle);
- el indicador **En vivo** muestra la hora de la última consulta y se pausa si la pestaña
  queda oculta.

El polling funciona con Supabase y con el backend en memoria (en memoria solo dentro de la
misma instancia del servidor).

## Conversión a pesos

Las facturas en moneda extranjera se convierten con una cotización **con fuente y fecha**, que
trae el código (nunca el modelo):

- **USD**: [ArgentinaDatos](https://api.argentinadatos.com) — histórico por casa (`oficial`,
  `blue`, `bolsa`, `contadoconliqui`, `mayorista`, `tarjeta`).
- **Otras monedas**: cruce con el tipo de referencia del BCE vía
  [Frankfurter](https://api.frankfurter.app).

Si el comprobante trae su propia cotización, se respeta y se compara con la de mercado: si
difiere más de 5%, queda un aviso.

| Variable | Descripción |
| --- | --- |
| `FX_ENABLED` | `false` desactiva la conversión automática. Default `true`. |
| `FX_TIPO` | Casa del dólar. Default `oficial`. |
| `FX_LADO` | `venta` o `compra`. Default `venta`. |

> Qué tipo de cambio corresponde para registrar cada comprobante es una decisión contable:
> confirmalo con un contador antes de usarlo en producción.

## Controles que aplica el motor

- Dígito verificador de CUIT (módulo 11) en emisor y receptor.
- Coherencia `subtotal + impuestos + percepciones = total`.
- Coherencia `cantidad × precio unitario = importe` por ítem.
- Fechas válidas, no futuras y no anteriores a dos años.
- CAE obligatorio en facturas y notas.
- Tipo de cambio obligatorio si la moneda no es ARS.
- Detección de comprobantes duplicados (emisor + tipo + punto de venta + número).
- Señales del modelo: `camposDudosos` y confianza baja.

## Verificación sin API key

```bash
pnpm verify
```

Corre las reglas de CUIT, parseo de importes y fechas, normalización, validación y duplicados
sobre casos conocidos.

## Deploy en Vercel

1. Importá el repo en Vercel.
2. Cargá `GEMINI_API_KEY` (o `OPENAI_API_KEY`) en *Environment Variables*.
3. Deploy. No hace falta base de datos: las facturas aprobadas se guardan en el navegador.

## Próximos pasos

- Lectura del QR de ARCA antes del modelo (determinística, gratis y auditable).
- Estados por campo (`seguro` / `supuesto` / `falta`) con origen y nota.
- Conversión de moneda con fuente y fecha.
- Memoria por proveedor para la imputación contable.
- Persistencia real (Postgres) y multiusuario.
