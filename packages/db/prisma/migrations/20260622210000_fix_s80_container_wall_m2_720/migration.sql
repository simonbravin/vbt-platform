-- S80 FCL wall m² per container: correct platform default to 720 (was wrongly 320 in early code).
UPDATE "platform_config"
SET
  "config_json" = jsonb_set(
    COALESCE("config_json", '{}'::jsonb),
    '{pricing,containerWallAreaM2S80}',
    '720'::jsonb,
    true
  ),
  "updated_at" = NOW()
WHERE ("config_json"->'pricing'->>'containerWallAreaM2S80') IS NULL
   OR ("config_json"->'pricing'->>'containerWallAreaM2S80')::numeric IN (320, 650);
