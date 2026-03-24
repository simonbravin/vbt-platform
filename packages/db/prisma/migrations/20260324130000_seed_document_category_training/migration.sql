-- Training module: default document category for study materials (idempotent on `code`).
INSERT INTO "document_categories" ("id", "name", "code", "description", "sort_order")
VALUES
  (
    'doccat_training',
    'Training & certification materials',
    'training',
    'Study materials linked from the training module.',
    15
  )
ON CONFLICT ("code") DO NOTHING;
