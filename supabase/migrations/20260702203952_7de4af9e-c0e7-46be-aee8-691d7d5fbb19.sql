
-- Profiles for ops team members
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user updates own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "user inserts own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Staff status enum
CREATE TYPE public.staff_status AS ENUM ('active','inactive');
CREATE TYPE public.centre_channel AS ENUM ('whatsapp','goto','email');
CREATE TYPE public.shift_status AS ENUM ('pending','filled','cancelled','completed');

-- Centres
CREATE TABLE public.centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  contact_title TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  preferred_channel public.centre_channel NOT NULL DEFAULT 'email',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centres TO authenticated;
GRANT ALL ON public.centres TO service_role;
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all centres" ON public.centres FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Staff
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  use_display_name BOOLEAN NOT NULL DEFAULT false,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  role TEXT DEFAULT '',
  status public.staff_status NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  documents_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all staff" ON public.staff FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Top / Banned link tables (two-way sync surface: shared source of truth)
CREATE TABLE public.staff_centre_top (
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, centre_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_centre_top TO authenticated;
GRANT ALL ON public.staff_centre_top TO service_role;
ALTER TABLE public.staff_centre_top ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all top" ON public.staff_centre_top FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.staff_centre_banned (
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, centre_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_centre_banned TO authenticated;
GRANT ALL ON public.staff_centre_banned TO service_role;
ALTER TABLE public.staff_centre_banned ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all banned" ON public.staff_centre_banned FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Availability: weekly ranges
CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- Monday
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon..6=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX availability_staff_week_idx ON public.availability (staff_id, week_start_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO authenticated;
GRANT ALL ON public.availability TO service_role;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all availability" ON public.availability FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Shifts
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE RESTRICT,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role_needed TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status public.shift_status NOT NULL DEFAULT 'pending',
  assigned_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  cancellation_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shifts_date_idx ON public.shifts (shift_date);
CREATE INDEX shifts_centre_idx ON public.shifts (centre_id);
CREATE INDEX shifts_assigned_idx ON public.shifts (assigned_staff_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all shifts" ON public.shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Contacted tracker
CREATE TABLE public.shift_contacted (
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_id, staff_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_contacted TO authenticated;
GRANT ALL ON public.shift_contacted TO service_role;
ALTER TABLE public.shift_contacted ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all contacted" ON public.shift_contacted FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_centres_updated BEFORE UPDATE ON public.centres FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-complete filled shifts whose end datetime has passed
CREATE OR REPLACE FUNCTION public.auto_complete_shifts() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.shifts
  SET status = 'completed'
  WHERE status = 'filled'
    AND (shift_date + end_time) <= now();
$$;

-- Schedule the auto-complete every minute
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('auto-complete-shifts', '* * * * *', $$SELECT public.auto_complete_shifts();$$);
