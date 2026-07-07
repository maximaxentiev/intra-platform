-- Ops feedback: Staffpoint, centre contacts, communication channels, shift comments
-- Safe additive migration — no drops, backfills existing data.
-- Idempotent: safe to re-run if a step partially applied.

-- 1. Staffpoint flag on shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS added_to_staffpoint BOOLEAN NOT NULL DEFAULT false;

-- 2. Primary communication channel on centres (backfill from preferred_channel)
ALTER TABLE public.centres
  ADD COLUMN IF NOT EXISTS primary_channel public.centre_channel;

UPDATE public.centres
SET primary_channel = preferred_channel
WHERE primary_channel IS NULL;

UPDATE public.centres
SET primary_channel = 'email'
WHERE primary_channel IS NULL;

ALTER TABLE public.centres
  ALTER COLUMN primary_channel SET DEFAULT 'email';

ALTER TABLE public.centres
  ALTER COLUMN primary_channel SET NOT NULL;

-- Keep preferred_channel in sync for any legacy reads
UPDATE public.centres
SET preferred_channel = primary_channel
WHERE preferred_channel IS DISTINCT FROM primary_channel;

-- 3. Secondary communication channels (multi-select per centre; junction table)
CREATE TABLE IF NOT EXISTS public.centre_secondary_channels (
  centre_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  channel public.centre_channel NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (centre_id, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.centre_secondary_channels TO authenticated;
GRANT ALL ON public.centre_secondary_channels TO service_role;
ALTER TABLE public.centre_secondary_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated all centre_secondary_channels" ON public.centre_secondary_channels;
CREATE POLICY "authenticated all centre_secondary_channels"
  ON public.centre_secondary_channels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Multiple contacts per centre with priority ordering
CREATE TABLE IF NOT EXISTS public.centre_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS centre_contacts_centre_idx
  ON public.centre_contacts (centre_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.centre_contacts TO authenticated;
GRANT ALL ON public.centre_contacts TO service_role;
ALTER TABLE public.centre_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated all centre_contacts" ON public.centre_contacts;
CREATE POLICY "authenticated all centre_contacts"
  ON public.centre_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_centre_contacts_updated ON public.centre_contacts;
CREATE TRIGGER trg_centre_contacts_updated
  BEFORE UPDATE ON public.centre_contacts
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Migrate legacy flat contact fields into centre_contacts (once per centre)
INSERT INTO public.centre_contacts (centre_id, name, title, email, phone, sort_order)
SELECT
  c.id,
  COALESCE(NULLIF(c.contact_name, ''), 'Primary contact'),
  COALESCE(c.contact_title, ''),
  COALESCE(c.contact_email, ''),
  COALESCE(c.contact_phone, ''),
  0
FROM public.centres c
WHERE (
  NULLIF(c.contact_name, '') IS NOT NULL
  OR NULLIF(c.contact_email, '') IS NOT NULL
  OR NULLIF(c.contact_phone, '') IS NOT NULL
  OR NULLIF(c.contact_title, '') IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM public.centre_contacts cc WHERE cc.centre_id = c.id
);

-- 5. Internal shift comments
CREATE TABLE IF NOT EXISTS public.shift_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shift_comments_shift_idx
  ON public.shift_comments (shift_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_comments TO authenticated;
GRANT ALL ON public.shift_comments TO service_role;
ALTER TABLE public.shift_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated all shift_comments" ON public.shift_comments;
CREATE POLICY "authenticated all shift_comments"
  ON public.shift_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
