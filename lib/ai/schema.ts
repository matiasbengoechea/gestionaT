/**
 * Esquema canónico de extracción.
 *
 * Se escribe en el dialecto "strict" de OpenAI (todos los campos en `required`,
 * `additionalProperties: false`) y se traduce al dialecto de Gemini con
 * `toGeminiSchema`. Así ambos proveedores devuelven exactamente la misma forma.
 */

export type JsonSchema = Record<string, unknown>;

const partySchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["razonSocial", "cuit", "condicionIva", "domicilio"],
  properties: {
    razonSocial: {
      type: "string",
      description: "Razón social completa. Cadena vacía si no se puede leer.",
    },
    cuit: {
      type: "string",
      description: "CUIT con o sin guiones. Cadena vacía si no se puede leer.",
    },
    condicionIva: {
      type: "string",
      description:
        "Condición frente al IVA: Responsable Inscripto, Monotributo, Exento, Consumidor Final, etc.",
    },
    domicilio: { type: "string", description: "Domicilio declarado. Cadena vacía si no figura." },
  },
};

const itemSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "descripcion",
    "descripcionOriginal",
    "cantidad",
    "unidad",
    "precioUnitario",
    "alicuotaIva",
    "importe",
    "cuentaContable",
  ],
  properties: {
    descripcion: {
      type: "string",
      description:
        "Descripción normalizada y traducida al español rioplatense, clara para un contador.",
    },
    descripcionOriginal: {
      type: "string",
      description: "Texto literal del ítem tal como figura en el comprobante.",
    },
    cantidad: { type: "number", description: "Cantidad. 1 si no se especifica." },
    unidad: {
      type: "string",
      description: "Unidad de medida: unidad, kg, litro, hora, servicio, etc.",
    },
    precioUnitario: { type: "number", description: "Precio unitario sin impuestos." },
    alicuotaIva: {
      type: "number",
      description: "Alícuota de IVA del ítem en porcentaje: 21, 10.5, 27 o 0.",
    },
    importe: {
      type: "number",
      description: "Importe total del ítem sin impuestos (cantidad × precio unitario).",
    },
    cuentaContable: {
      type: "string",
      description:
        "Código del plan de cuentas del cliente que mejor imputa este ítem. Cadena vacía si ninguno aplica.",
    },
  },
};

const taxSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tipo", "base", "alicuota", "importe"],
  properties: {
    tipo: {
      type: "string",
      description: "Tipo de impuesto o percepción: IVA 21%, IVA 10.5%, Percepción IIBB, etc.",
    },
    base: { type: "number", description: "Base imponible." },
    alicuota: { type: "number", description: "Alícuota en porcentaje. 0 si no aplica." },
    importe: { type: "number", description: "Importe del impuesto." },
  },
};

export const invoiceJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "tipoComprobante",
    "origen",
    "puntoDeVenta",
    "numero",
    "fechaEmision",
    "fechaVencimiento",
    "emisor",
    "receptor",
    "moneda",
    "tipoCambio",
    "items",
    "subtotal",
    "impuestos",
    "percepciones",
    "total",
    "cae",
    "caeVencimiento",
    "idiomaOriginal",
    "observaciones",
    "camposDudosos",
    "confianza",
  ],
  properties: {
    tipoComprobante: {
      type: "string",
      enum: [
        "Factura A",
        "Factura B",
        "Factura C",
        "Factura M",
        "Nota de Crédito A",
        "Nota de Crédito B",
        "Nota de Crédito C",
        "Nota de Débito A",
        "Nota de Débito B",
        "Nota de Débito C",
        "Recibo",
        "Ticket",
        "Factura exterior",
        "Otro",
      ],
      description:
        "Tipo de comprobante. Usá 'Factura exterior' para comprobantes emitidos por proveedores del exterior.",
    },
    origen: {
      type: "string",
      enum: ["local", "exterior"],
      description:
        "'local' si es un comprobante AFIP argentino (CUIT + CAE). 'exterior' si el emisor está fuera de Argentina (VAT/NIF, sin CAE).",
    },
    puntoDeVenta: {
      type: "string",
      description: "Punto de venta, con ceros a la izquierda si figuran (ej. 0003).",
    },
    numero: {
      type: "string",
      description: "Número del comprobante, sin el punto de venta.",
    },
    fechaEmision: {
      type: "string",
      description: "Fecha de emisión en formato YYYY-MM-DD. Cadena vacía si no se puede leer.",
    },
    fechaVencimiento: {
      type: ["string", "null"],
      description: "Fecha de vencimiento en formato YYYY-MM-DD, o null si no aplica.",
    },
    emisor: partySchema,
    receptor: partySchema,
    moneda: {
      type: "string",
      description: "Código ISO 4217 de la moneda del comprobante: ARS, USD, EUR, etc.",
    },
    tipoCambio: {
      type: ["number", "null"],
      description: "Tipo de cambio a ARS si la moneda no es ARS. null si no aplica.",
    },
    items: {
      type: "array",
      description: "Todos los ítems o conceptos del comprobante.",
      items: itemSchema,
    },
    subtotal: {
      type: "number",
      description: "Subtotal sin impuestos, tal como figura en el comprobante.",
    },
    impuestos: {
      type: "array",
      description: "Impuestos liquidados (IVA, impuestos internos).",
      items: taxSchema,
    },
    percepciones: {
      type: "array",
      description: "Percepciones (IIBB, IVA, ganancias).",
      items: taxSchema,
    },
    total: { type: "number", description: "Total final del comprobante." },
    cae: {
      type: ["string", "null"],
      description: "Código de Autorización Electrónico (CAE/CAI). null si no figura.",
    },
    caeVencimiento: {
      type: ["string", "null"],
      description: "Vencimiento del CAE en formato YYYY-MM-DD. null si no figura.",
    },
    idiomaOriginal: {
      type: "string",
      description: "Idioma del comprobante original: español, inglés, portugués, etc.",
    },
    observaciones: {
      type: "string",
      description:
        "Notas relevantes para la contabilización: condición de pago, orden de compra, remitos, etc. Cadena vacía si no hay.",
    },
    camposDudosos: {
      type: "array",
      description:
        "Nombres de los campos que no se pudieron leer con certeza (ej. 'numero', 'total').",
      items: { type: "string" },
    },
    confianza: {
      type: "number",
      description:
        "Confianza global de la extracción entre 0 y 1. Sé conservador: si el documento está borroso o incompleto, bajala.",
    },
  },
};

type GeminiType =
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "ARRAY"
  | "OBJECT";

function geminiType(type: string): GeminiType {
  switch (type) {
    case "integer":
      return "INTEGER";
    case "number":
      return "NUMBER";
    case "boolean":
      return "BOOLEAN";
    case "array":
      return "ARRAY";
    case "object":
      return "OBJECT";
    default:
      return "STRING";
  }
}

/** Convierte el esquema canónico al dialecto `responseSchema` de Gemini. */
export function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  const type = schema.type;

  if (Array.isArray(type)) {
    const nonNull = type.filter((entry) => entry !== "null");
    out.type = geminiType(String(nonNull[0] ?? "string"));
    if (type.includes("null")) out.nullable = true;
  } else if (typeof type === "string") {
    out.type = geminiType(type);
  }

  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;

  if (schema.properties && typeof schema.properties === "object") {
    const properties = schema.properties as Record<string, JsonSchema>;
    out.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }

  if (schema.required) out.required = schema.required;
  if (schema.items) out.items = toGeminiSchema(schema.items as JsonSchema);

  return out;
}
