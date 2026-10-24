/**
 * Perfiles de cliente de demostración.
 *
 * El contexto del cliente se inyecta en el prompt: es lo que le permite al
 * modelo "entender el negocio" y sugerir una imputación contable coherente
 * con el plan de cuentas de cada organización.
 */

export interface PlanCuenta {
  cuenta: string;
  descripcion: string;
}

export interface ClientProfile {
  id: string;
  nombre: string;
  cuit: string;
  rubro: string;
  condicionIva: string;
  domicilio: string;
  /** Contexto de negocio que se agrega al prompt. */
  contexto: string;
  planCuentas: PlanCuenta[];
}

export const CLIENTS: ClientProfile[] = [
  {
    id: "estudio-del-plata",
    nombre: "Estudio Contable Del Plata",
    cuit: "30-71234567-1",
    rubro: "Estudio contable / gestoría",
    condicionIva: "Responsable Inscripto",
    domicilio: "Av. Corrientes 1234, CABA",
    contexto:
      "Gestoría que procesa las compras de sus clientes PyME (comercio y servicios). " +
      "Las facturas pueden estar emitidas a nombre de distintos clientes del estudio, " +
      "por lo que el receptor no siempre coincide con el CUIT del estudio. " +
      "Se prioriza detectar el tipo de comprobante AFIP y el IVA crédito fiscal.",
    planCuentas: [
      { cuenta: "1.1.4.01", descripcion: "Mercaderías" },
      { cuenta: "1.1.4.02", descripcion: "Insumos y materiales" },
      { cuenta: "1.2.1.01", descripcion: "IVA Crédito Fiscal" },
      { cuenta: "5.2.1.01", descripcion: "Servicios (luz, gas, internet, telefonía)" },
      { cuenta: "5.2.2.01", descripcion: "Honorarios profesionales" },
      { cuenta: "5.2.3.01", descripcion: "Fletes y logística" },
      { cuenta: "5.3.1.01", descripcion: "Gastos bancarios" },
    ],
  },
  {
    id: "metalurgica-aconcagua",
    nombre: "Metalúrgica Aconcagua S.A.",
    cuit: "30-71456789-2",
    rubro: "Industria metalúrgica",
    condicionIva: "Responsable Inscripto",
    domicilio: "Parque Industrial, San Nicolás, Buenos Aires",
    contexto:
      "Planta metalúrgica que compra acero, insumos de producción y bienes de uso. " +
      "Recibe facturas de proveedores locales y del exterior (frecuentemente en USD, " +
      "con descripciones en inglés). Los fletes y el mantenimiento son gastos recurrentes.",
    planCuentas: [
      { cuenta: "1.1.4.10", descripcion: "Materias primas - acero" },
      { cuenta: "1.1.4.11", descripcion: "Insumos de producción" },
      { cuenta: "1.1.5.01", descripcion: "Bienes de uso / maquinaria" },
      { cuenta: "1.2.1.01", descripcion: "IVA Crédito Fiscal" },
      { cuenta: "5.2.3.01", descripcion: "Fletes y logística" },
      { cuenta: "5.2.4.01", descripcion: "Energía eléctrica" },
      { cuenta: "5.2.5.01", descripcion: "Mantenimiento y repuestos" },
    ],
  },
  {
    id: "vinedos-san-rafael",
    nombre: "Viñedos San Rafael S.A.",
    cuit: "30-71567890-6",
    rubro: "Agroindustria / bodega",
    condicionIva: "Responsable Inscripto",
    domicilio: "Ruta 143 Km 12, San Rafael, Mendoza",
    contexto:
      "Bodega con viñedos propios. Compra insumos agrícolas, envases (botellas, corchos, " +
      "etiquetas), servicios de laboratorio y despachantes de exportación. " +
      "Es habitual recibir facturas en USD y en otros idiomas.",
    planCuentas: [
      { cuenta: "1.1.4.20", descripcion: "Insumos agrícolas" },
      { cuenta: "1.1.4.21", descripcion: "Envases y embalajes" },
      { cuenta: "1.2.1.01", descripcion: "IVA Crédito Fiscal" },
      { cuenta: "5.2.6.01", descripcion: "Servicios de viñedo" },
      { cuenta: "5.2.7.01", descripcion: "Laboratorio y análisis" },
      { cuenta: "5.2.8.01", descripcion: "Exportación y despachantes" },
    ],
  },
];

/**
 * Perfil genérico: permite procesar cualquier factura sin configurar un cliente.
 * No tiene CUIT, así que no se controla el receptor contra él.
 */
export const GENERIC_CLIENT: ClientProfile = {
  id: "generico",
  nombre: "Cliente genérico",
  cuit: "",
  rubro: "Sin configurar",
  condicionIva: "",
  domicilio: "",
  contexto:
    "No hay un cliente configurado. Extraé los datos del comprobante sin asumir un plan de cuentas específico. " +
    "Si hay una cuenta razonablemente aplicable del plan genérico, usala.",
  planCuentas: [
    { cuenta: "1.1.4.01", descripcion: "Mercaderías" },
    { cuenta: "1.1.4.02", descripcion: "Insumos y materiales" },
    { cuenta: "1.2.1.01", descripcion: "IVA Crédito Fiscal" },
    { cuenta: "5.2.1.01", descripcion: "Servicios" },
    { cuenta: "5.2.2.01", descripcion: "Honorarios profesionales" },
    { cuenta: "5.2.3.01", descripcion: "Fletes y logística" },
    { cuenta: "5.2.5.01", descripcion: "Mantenimiento y repuestos" },
    { cuenta: "5.3.1.01", descripcion: "Gastos bancarios" },
  ],
};

/** Cliente por defecto cuando no se especifica uno. */
export const DEFAULT_CLIENT_ID = GENERIC_CLIENT.id;

export function getClient(id: string | null | undefined): ClientProfile | undefined {
  if (id === GENERIC_CLIENT.id) return GENERIC_CLIENT;
  return CLIENTS.find((client) => client.id === id);
}
