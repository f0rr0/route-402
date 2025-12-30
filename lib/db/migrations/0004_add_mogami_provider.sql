DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'mogami'
      AND enumtypid = 'facilitator_provider'::regtype
  ) THEN
    ALTER TYPE facilitator_provider ADD VALUE 'mogami';
  END IF;
END $$;
