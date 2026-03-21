# Flujo de ingeniería (distribuidor + plataforma)

## Estados (`EngineeringRequestStatus`)

| Estado | Significado operativo |
|--------|------------------------|
| `draft` | El partner arma la solicitud; aún no enviada a cola central. |
| `submitted` | Enviada a la plataforma para ingreso a revisión. |
| `in_review` | Ingeniería / superadmin analizando planos e insumos. |
| `pending_info` | Falta información o documentación; puede requerir acción del partner. |
| `needs_info` | Devolución explícita al partner con observaciones (suele ir acompañada de un evento de revisión visible para partner). |
| `in_progress` | Trabajo técnico en curso en casa (diseño, cálculo, documentación). |
| `completed` | Trabajo técnico concluido en origen; puede preceder a la entrega formal al partner. |
| `delivered` | Paquete técnico entregado al partner. **Es el estado que la plataforma usa como “ingeniería cerrada” para habilitar cotización** cuando el partner tiene activada la política estricta (ver abajo). |
| `rejected` | La solicitud no procede o queda fuera de alcance. |

## Gate para cotizar

- **Por defecto**: cualquier partner puede crear cotizaciones sin comprobar ingeniería (comportamiento histórico).
- **Opcional por partner** (`PartnerProfile.requireDeliveredEngineeringForQuotes`): al crear una cotización vía API SaaS, el servidor exige que exista al menos una `EngineeringRequest` en estado `delivered` para el mismo `projectId` y `organizationId`.
- **Trazabilidad**: el campo opcional `Quote.engineeringRequestId` vincula una cotización con la solicitud de ingeniería que la respalda (recomendado cuando aplica el flujo técnico).

## Eventos de revisión (`EngineeringReviewEvent`)

- Registran comentarios y, opcionalmente, transiciones de estado (`fromStatus` / `toStatus`) para auditoría y timeline en UI.
- `visibility`: `partner` (visible en portal partner) o `internal` (solo plataforma / superadmin).

## Permisos (resumen)

- **Partner**: lista y edita solicitudes de su organización; solo crea eventos con `visibility: partner`; no puede crear notas `internal`.
- **Superadmin**: lista cross-tenant cuando no hay organización activa en contexto (cookie `vbt-active-org` vacía); puede crear eventos `internal` y `partner`, y actualizar estados en combinación con un evento.
