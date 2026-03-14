# Checklist antes de commit y push

Ejecutar antes de hacer **commit** y **push** para evitar romper build o producción.

## 1. Build

```bash
pnpm run build
```

- Debe terminar sin errores de TypeScript ni de lint.
- Si falla, corregir antes de hacer push.

## 2. Migraciones

- Si tocaste el schema de Prisma (`packages/db/prisma/schema.prisma`), crea migración y aplica en local:
  ```bash
  cd packages/db && npx prisma migrate dev --name descripcion_corta
  ```
- No hagas push con migraciones pendientes sin haberlas probado en local.
- En producción/Neon **siempre** se aplican con: `cd packages/db && npx prisma migrate deploy`.

## 3. Verificación del esquema (opcional pero recomendado)

Con `DATABASE_URL` apuntando a la DB que uses (local o Neon):

```bash
cd packages/db && pnpm run verify-users-schema
```

- Debe imprimir: `Tabla users tiene las columnas requeridas`.
- Si falla, aplicar migraciones: `npx prisma migrate deploy`.

## 4. Resumen

| Paso              | Comando                          |
|-------------------|-----------------------------------|
| Build             | `pnpm run build`                  |
| Migraciones local | `cd packages/db && npx prisma migrate dev` (si cambiaste schema) |
| Verificar users   | `cd packages/db && pnpm run verify-users-schema` |
| Deploy DB         | En producción: `npx prisma migrate deploy` |

**No shortcuts:** El esquema de la base debe coincidir con Prisma. Usar siempre migraciones para cambios de schema; no parchear en código para esconder columnas faltantes.
