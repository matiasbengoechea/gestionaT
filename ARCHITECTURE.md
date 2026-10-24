# GestionaT: arquitectura

Software de gestión con IA que lee facturas, las interpreta, las traduce, convierte monedas y las deja listas para que una persona solo dé el ok. Track: **Vertical AI** (Shippear).

> Estado: diseño para una hackatón de ~6 horas (9:30 a 16:00). Los puntos marcados con **[verificar]** son supuestos que hay que confirmar antes de afirmarlos en el pitch.

---

## 1. Principios de diseño

1. **Completar, no rechazar.** Ninguna factura queda trabada. Cada campo se completa con su mejor resultado y queda en uno de tres estados: `seguro`, `supuesto` (con la explicación de cómo se obtuvo) o `falta`.
2. **El modelo extrae, el código calcula.** Las sumas, conversiones, validaciones y cotizaciones las hace código determinístico. El modelo nunca "recuerda" una cotización ni hace aritmética.
3. **Trazabilidad.** Cada dato guarda de dónde salió (QR, modelo, regla, cotización con fuente y fecha) y cada acción queda en un registro de auditoría.
4. **La persona decide.** El sistema propone; una persona confirma. Las acciones con efecto piden confirmación humana.
5. **No pedir que el cliente cambie de software.** Se entrega algo que su sistema actual ya sabe recibir.

## 2. Alcance

**Entra en el MVP (sábado)**
- Subida de varias facturas (PDF e imágenes).
- Lectura del QR en facturas argentinas y extracción con modelo para el resto.
- Estados por campo, validaciones, conversión a pesos con fuente y fecha visibles.
- Cuenta contable propuesta por historial del proveedor y asiento propuesto.
- Pantalla de revisión y ok, con resumen del lote.
- Exportación a CSV/Excel y un endpoint de API.
- Agente para anomalías y para consultas en lenguaje natural (si alcanza el tiempo).

**Queda como hoja de ruta (no prometer)**
- Ingesta por mail o WhatsApp, cruce con comprobantes recibidos de ARCA.
- Adaptadores a software contable específico, libros de IVA con formato oficial.
- Automatización de pantalla (RPA) para sistemas sin importación.
- Seguridad y cumplimiento de nivel empresarial.

## 3. Vista general

```
 Usuario ──► Next.js (UI + rutas API)  ──► Supabase (Postgres + Storage)
                 │                              ▲
                 ├─► Lectura de QR (determinística)
                 ├─► Modelo vía OpenRouter (AI SDK) ── extracción con esquema
                 ├─► Servicios de cotización (con caché)
                 ├─► Validaciones y cálculos (código)
                 └─► Agente (ToolLoopAgent) ── herramientas cerradas
                                   │
                          Exportación CSV/Excel · API JSON
```

## 4. Stack

| Capa | Elección | Nota |
|---|---|---|
| Interfaz y despliegue | Next.js en Vercel | Esqueleto de pantallas generado con v0 |
| Datos y archivos | Supabase (Postgres, Storage) | Integración de Vercel carga las variables |
| Modelos | OpenRouter | Modelo fijado por variable de entorno |
| Capa de IA | Vercel AI SDK (`ai`) | Salida estructurada con Zod, agente con herramientas |
| Validación de datos | Zod | Esquemas de entrada y salida |

Los modelos candidatos salen de las búsquedas en OpenRouter (DeepSeek V4.1 Flash, GLM 5.3 Flash, GPT-6 Luna, Gemini 4 Argon, ScaleDown Extract). **[verificar]** precios, IDs, entrada de imagen/PDF y salida estructurada en la ficha de cada uno, y probarlos con el lote de facturas.

## 5. Ingesta

1. **Subida web múltiple** (PDF, JPG, PNG, ZIP). El original se guarda en Storage y cada factura es una tarea independiente con estado: `en_cola`, `leyendo`, `completa`, `error`.
2. **Preproceso:** separar PDFs con varias facturas, detectar duplicados por huella del archivo, avisar si la imagen es ilegible.
3. **QR primero (facturas argentinas).** El QR del comprobante electrónico es una URL con un JSON en Base64. Según la especificación de ARCA, incluye fecha, CUIT del emisor, punto de venta, tipo y número de comprobante, importe total, moneda, cotización, documento del receptor y código de autorización. Se decodifica con código, sin modelo.
4. **Modelo para el resto:** renglones, neto, IVA por alícuota, concepto, traducción, y todo lo que no trae el QR. Si lo que lee el modelo no coincide con el QR, se deja un aviso.
5. **Facturas del exterior:** no tienen QR; las lee el modelo y se identifican como "exterior" para adaptar los campos.

## 6. Extracción y modelo de datos

Cada campo se devuelve con este formato (esquema Zod):

```ts
const Campo = z.object({
  valor: z.string().nullable(),
  estado: z.enum(["seguro", "supuesto", "falta"]),
  nota: z.string().optional(),     // por qué es un supuesto
  origen: z.enum(["qr", "modelo", "regla", "cotizacion", "historial", "manual"]),
  posicion: z.object({ pagina: z.number(), bbox: z.array(z.number()) }).optional(), // si el modelo u OCR la entrega
});
```

Casos que el diseño cubre:
- Número de factura en un lugar o con una etiqueta distinta a la habitual: se completa con el mejor candidato y queda como `supuesto` con la explicación.
- Dato ausente (por ejemplo, un CAE): ese campo queda en `falta` y el resto de la factura se carga igual.
- Fecha sin cotización publicada (fin de semana, feriado): se usa la del último día hábil anterior y se explica.

### Tablas (Supabase, esquema orientativo)

| Tabla | Contenido |
|---|---|
| `lotes` | Conjunto de facturas subidas juntas y sus métricas |
| `facturas` | Una por comprobante: archivo, estado, moneda, totales, proveedor |
| `factura_campos` | Un registro por campo: valor, estado, nota, origen, posición, confirmado_por |
| `avisos` | Duplicados, totales que no cierran, CUIT con dígito verificador inválido (no bloquean) |
| `proveedores` | Datos maestros e historial de cuentas asignadas |
| `cotizaciones_cache` | Moneda, fecha, tipo, valor, fuente, momento de consulta |
| `auditoria` | Quién o qué hizo cada cambio, con qué herramienta y qué devolvió |

## 7. Validaciones y cálculos (código determinístico)

- Los renglones suman el neto; neto más impuestos coincide con el total.
- Duplicados: mismo proveedor, número, fecha y monto.
- Formato del CUIT con dígito verificador (solo formato; no prueba que el contribuyente exista).
- Conversión a pesos con la cotización de la fecha de la factura, fuente a la vista.
- Si la factura imprime un equivalente en otra moneda, se compara con la cotización implícita y se avisa si difieren.

**Cotizaciones.** Opciones a evaluar: APIs abiertas con cotizaciones argentinas e históricas (DolarApi.com, ArgentinaDatos) y tipos de referencia del BCE para monedas europeas. Para monedas como la libra puede hacer falta una cotización cruzada. **[verificar]** que las APIs sigan activas, qué devuelven en fines de semana y feriados, y que sean valores de referencia.

**Pendiente de confirmar con un contador:** qué fuente, qué tipo (comprador, vendedor, mayorista) y qué fecha de cotización corresponde para registrar facturas en moneda extranjera, y cómo se tratan impositivamente las facturas del exterior. **[verificar]**

**Valores impositivos** (escalas, alícuotas, topes): tabla con "vigente desde" y fuente oficial, cargada y verificada a mano. Siempre se muestra la fecha de actualización.

## 8. Agente

El camino principal es un pipeline determinístico. El agente entra solo cuando algo falla o cuando el usuario pregunta.

**Herramientas (conjunto cerrado)**

- Consulta: `obtener_cotizacion(moneda, fecha, tipo)`, `obtener_factura(id)`, `buscar_facturas(...)`, `historial_proveedor(id)`.
- Cálculo: `validar_totales`, `convertir_moneda`, `detectar_duplicados`, `validar_identificador_fiscal` (solo formato), `consultar_gastos` (parámetros fijos, sin SQL libre).
- Acción (piden confirmación humana): `marcar_para_revision`, `redactar_mail_proveedor` (borrador, no envía), `aprobar_factura` (la ejecuta una persona).

**Reglas**
- Máximo de 6 pasos por ejecución (`stepCountIs`).
- El contenido de la factura es dato, nunca instrucciones: el prompt lo declara y las acciones sensibles exigen confirmación.
- La salida del agente tiene esquema fijo: diagnóstico, evidencia, confianza, acción propuesta.
- Los pasos del agente se muestran en pantalla y se guardan en `auditoria`.
- El modelo del agente necesita buen soporte de tool calling; puede ser distinto del que lee las facturas.

## 9. Salida

1. **Pantalla de revisión:** semáforo por factura, campos con estado, confirmación campo por campo o todo junto, carga manual de lo que falta, asiento propuesto.
2. **Exportación CSV/Excel:** una fila por factura (comprobante, CUIT, razón social, neto, IVA, total, moneda, cotización con fuente, cuenta, asiento).
3. **API:** `POST /api/facturas` (enviar) y `GET /api/facturas/:id` (resultado en JSON).
4. **Memoria por proveedor:** cada corrección humana (por ejemplo, la cuenta) se guarda y se aplica en la próxima factura del mismo proveedor.

### Clientes con software legacy (sin APIs)

Escalera, de menos a más invasivo:
1. **Archivos de importación** (CSV, Excel, TXT) con un adaptador por sistema, probado contra la herramienta real de importación. Primer escalón y el más realista.
2. **Carpeta compartida o SFTP** para volúmenes grandes.
3. **RPA** (robot que carga en pantalla): último recurso, frágil, siempre supervisado.

No se escribe directo en la base de datos del sistema legacy. Para generar confianza se propone una **conciliación de ida y vuelta**: comparar cantidad de comprobantes y totales contra el reporte del sistema del cliente. Importar plan de cuentas y proveedores como datos maestros.

## 10. Seguridad y configuración

```bash
# .env.local (nunca subir a Git)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # SECRETA, solo servidor
OPENROUTER_API_KEY=...           # SECRETA, solo servidor, con límite de gasto
OPENROUTER_MODEL=...             # modelo fijo, con un plan B anotado
MAX_UPLOAD_MB=5
```

- `NEXT_PUBLIC_` significa visible para cualquiera: solo la URL y la clave anon de Supabase.
- Activar políticas de acceso por fila (RLS), bucket privado y enlaces temporales.
- Límites de tamaño, tipo de archivo y pedidos por usuario (público probando, presupuesto de API).
- Aumentar el tiempo máximo de las funciones donde corra la extracción.
- Usar solo facturas ficticias o anonimizadas. No usar documentos ni capturas con datos reales de personas o empresas.
- Rotar claves al terminar el evento.

## 11. Despliegue

1. Cuentas y claves la noche anterior (GitHub, Vercel, Supabase, OpenRouter con límite de gasto). **[verificar]** en el reglamento si se puede llevar código previo.
2. Proyecto creado en v0 (esqueleto de pantallas), conectado a Supabase desde la integración de Vercel y publicado.
3. Variables de entorno cargadas y nuevo despliegue tras cada cambio.
4. Lógica de extracción, validaciones y agente en rutas de servidor propias, sincronizadas por GitHub. **[verificar]** que el plan de v0 permita la sincronización.
5. Prueba de punta a punta en el link público, desde otro dispositivo y otra red, antes de las 15:00.

## 12. Plan por hora

| Horario | Objetivo |
|---|---|
| 9:30 a 10:30 | Alcance, esquema de datos, esqueleto desplegado con link público |
| 10:30 a 12:00 | QR más extracción con estados por campo |
| 12:00 a 13:00 | Validaciones, conversión de moneda con fuente, asiento |
| 13:00 a 14:00 | Almuerzo; pruebas del lote y envío del link a usuarios de prueba |
| 14:00 a 15:00 | Pantalla de revisión, exportación, agente (si alcanza) |
| 15:00 a 15:30 | Video de respaldo, README, entrega (primer llamado 15:30, cierre 16:00) |

Si falta tiempo, se sacrifica la interfaz pulida antes que los estados por campo, la conversión con fuente y la trazabilidad.

## 13. Lote de demostración (facturas inventadas)

1. Factura en libras con el número en un campo "Ref." y un equivalente impreso en otra moneda.
2. Factura en euros desde el exterior.
3. Factura A local con QR, CUIT y CAE.
4. Factura C con punto de venta y número en lugares distintos y un CAE ausente.
5. Factura en dólares con fecha de sábado.

Métricas a mostrar: facturas completadas solas, campos seguros / supuestos / faltantes y tiempo estimado contra el trabajo manual, **con supuestos editables y reemplazados por mediciones reales** antes del pitch.

## 14. Qué es real y qué es simulado hoy

- El prototipo publicado usa facturas, cotizaciones, cuentas y razonamiento del agente **ficticios y guionados**; no hay un modelo conectado.
- Nada de la integración con sistemas contables, ARCA o libros de IVA está construido.
- Ninguna cifra de mercado o de tiempo ahorrado está validada. Para el pitch, llevar la fuente de cada número.

## 15. Decisiones pendientes

- Qué software contable usan los clientes objetivo (define el primer adaptador de exportación).
- Qué cotización, fuente y fecha se usa en su flujo para moneda extranjera.
- Cómo ingresaban las facturas en su flujo actual (mail, escaneos, descargas) y adónde iba el resultado.
- Modelo principal y plan B, tras la prueba con el lote.
- Si ScaleDown Extract responde al formato de chat estándar; si no, función adaptadora.
- Reglas del evento sobre código previo y créditos de v0.
- Qué parte del agente entra el sábado y cuál queda como hoja de ruta.
