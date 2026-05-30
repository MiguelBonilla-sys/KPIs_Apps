# Módulo 2 — KPI Ops (Google Apps Script + Telegram)

Sistema de seguimiento de KPIs con detección automática de alertas y envío de resumen ejecutivo por Telegram, sobre Google Sheets y Apps Script.

---

## Arquitectura

```
Google Sheets (KPIs, Weekly_Metrics, Alerts, Logs)
        ↓
Apps Script — runAll()
        ↓
Telegram Bot API — sendMessage (outbound)
```

Notificación unidireccional: Apps Script lee el Sheet, evalúa KPIs y envía alertas a Telegram. No requiere webhook ni servidor externo.

---

## Estructura del Sheet

| Hoja | Columnas |
|---|---|
| `KPIs` | kpi_id · team · target · threshold · current_value |
| `Weekly_Metrics` | week · kpi_id · value · owner |
| `Alerts` | timestamp · kpi · severity · message |
| `Logs` | timestamp · process · status · detail |

El formato de semana es `YYYY-Www` (ej: `2024-W03`).

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `Config.gs` | Configuración centralizada (hojas, Telegram, límites) |
| `Main.gs` | Orquestador — `runAll()` y menú manual en el Sheet |
| `DataService.gs` | Carga y validación de KPIs y métricas semanales |
| `AlertEngine.gs` | Evaluación de alertas y deduplicación por hash |
| `ReportService.gs` | Construcción del resumen ejecutivo HTML |
| `TelegramService.gs` | Envío por Telegram Bot API con reintentos y fallback |
| `SheetService.gs` | Lectura y escritura de hojas |
| `Logger.gs` | Escribe logs en la hoja `Logs` |
| `Utils.gs` | Helpers: parseNumber, parseWeek, truncate, escapeHtml |
| `Setup.gs` | Configuración de propiedades, triggers y helpers de Telegram |
| `Tests.gs` | Suite de pruebas — ejecutar `runAllTests()` |

---

## Configuración inicial

Apps Script no lee archivos `.env`. Los secretos van en **Script Properties**, nunca en el código fuente.

### Opción A — UI guiada

```
Extensions > Apps Script > Setup.gs > ejecutar setAllConfig()
```

Aparecen prompts para ingresar token y chat_id.

### Opción B — Manual

```
Configuración del proyecto > Propiedades del script > Agregar:
  TELEGRAM_TOKEN    → token de @BotFather
  TELEGRAM_CHAT_ID  → tu chat_id numérico
```

### Obtener el chat_id

1. Crea un bot con `@BotFather` en Telegram y copia el token
2. Escríbele `/start` al bot desde tu cuenta
3. En Apps Script ejecuta `getTelegramChatId()` y revisa los logs
4. Busca `"chat":{"id": 123456789}` — ese número es el `TELEGRAM_CHAT_ID`

Si ves error 409 al llamar `getUpdates`, hay un webhook activo. Ejecuta `deleteTelegramWebhook()` en `Setup.gs` para eliminarlo.

---

## Ejecución

| Modo | Cómo |
|---|---|
| Manual | Menú **KPI Ops** > Run KPI Checks en el Sheet |
| Programado | `createDailyTrigger(8)` — corre diario a las 8 AM |
| Trigger UI | Apps Script > Activadores > Agregar > `runAll` > Cronómetro por día |

---

## Reglas de alertas

| Severidad | Condición |
|---|---|
| `CRIT` | `current_value < threshold` |
| `WARN` | Dato faltante, valor inválido o nulo |
| `WARN` (SYSTEM) | Métricas duplicadas detectadas |

La deduplicación usa `CacheService` con hash SHA-256 del contenido del mensaje y TTL de 1 hora. El mismo mensaje no se reenvía dentro de esa ventana. Limitación: el máximo de CacheService en Apps Script es 6 horas — condiciones que persisten más tiempo generan reenvíos.

---

## Casos edge soportados

| Caso | Comportamiento |
|---|---|
| KPI sin target | No genera alerta por threshold; sí por valor faltante |
| Métricas duplicadas | Alerta SYSTEM WARN + log |
| Datos inválidos | `parseNumber` normaliza formatos (`1.234,56`, `$1,000`, etc.) |
| Semana con formato incorrecto | Se ignora para calcular la semana más reciente |
| Errores de API Telegram | 3 reintentos con pausa de 1.5 s; fallback a texto plano si HTML falla |
| Mensajes repetidos | Dedupe por hash SHA-256 en CacheService |
| Filas vacías | Skipped con log de advertencia |

---

## Pruebas

```javascript
// En Apps Script → seleccionar runAllTests → Ejecutar
runAllTests()
// Ver resultados en Ver > Registros
```

Cubre: `parseNumber`, `parseWeek`, `compareWeek`, `truncate`, `escapeHtml`, lógica de alertas (threshold, datos faltantes, semana faltante, duplicados), y generación del resumen ejecutivo.

---

## Decisiones técnicas

- **Deduplicación por hash:** en lugar de comparar strings completos, se hashea el contenido del mensaje con SHA-256. Resiste cambios de formato sin falsos positivos.
- **Fallback a texto plano en Telegram:** si `parse_mode: HTML` falla (caracteres especiales no escapados), el servicio reintenta sin formato. El mensaje llega aunque no se vea bonito.
- **Lock de ejecución:** `runAll()` adquiere un `LockService` de 30 s antes de procesar. Evita corridas simultáneas si el trigger se dispara dos veces.
- **Config centralizada en `Config.gs`:** hojas, URL de Telegram, TTL de deduplicación y límites de mensajes en un solo objeto. Cambiar el nombre de una hoja no requiere buscar en todos los archivos.

## Supuestos

- El Sheet ya existe con las cuatro hojas (`KPIs`, `Weekly_Metrics`, `Alerts`, `Logs`). El sistema no las crea automáticamente.
- `current_value` en la hoja `KPIs` se usa si está presente; si no, se toma el valor de la métrica más reciente en `Weekly_Metrics`.
- Un KPI sin `threshold` nunca genera alerta de tipo CRIT, solo WARN si le faltan datos.

## Limitaciones

- Sin deduplicación duradera: el CacheService se borra al expirar el TTL. Condiciones de riesgo que persisten días generan reenvíos.
- Sin webhook entrante: el sistema solo envía, no recibe comandos de Telegram.
- Sin historial de alertas más allá de la hoja `Alerts` — no hay agregación temporal ni gráficas.

## Mejoras futuras

- Persistir alertas enviadas en hoja auxiliar para deduplicación sin límite de tiempo
- Soporte para webhook entrante (comandos desde Telegram para consultar KPIs on demand)
- Agregar threshold dinámico: que el sistema calcule el threshold basado en percentiles históricos de `Weekly_Metrics`

## Seguridad

- `.env.example` es referencia documental — Apps Script no lo lee
- Nunca guardes tokens en el código fuente
- Regenera el token desde `@BotFather → /revoke` si se expone accidentalmente
