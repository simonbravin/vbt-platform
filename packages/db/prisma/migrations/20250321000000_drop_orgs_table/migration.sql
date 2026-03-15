-- Eliminar tabla orgs: no se usa en la app (solo organizations). CASCADE quita FKs que apunten a orgs.
DROP TABLE IF EXISTS orgs CASCADE;
