# Organizations vs orgs (tablas en Neon)

## Resumen

- **`organizations`**: tabla que usa la app (modelo `Organization` en `schema.prisma`). Parteners/tenants: nombre, tipo, país, estado, etc. **Es la única tabla de organizaciones en uso.**
- **`orgs`**: tabla que **ya no existe**. Se eliminó por migración `20250321000000_drop_orgs_table` porque la app no la usaba (solo estaba en `schema.legacy.prisma` como referencia). El modelo `Org` sigue en el archivo legacy solo como documentación histórica.

## Estado actual

| Tabla | Estado | Uso |
|-------|--------|-----|
| **organizations** | Activa | App (partners, invitaciones, miembros, proyectos, cotizaciones, etc.) |
| **orgs** | Eliminada | Ninguno; tabla borrada en Neon y migración aplicada |

**Conclusión:** La app depende solo de `organizations`. La tabla `orgs` fue eliminada de la base y el código activo no la referencia.
