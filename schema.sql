CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Campus Guest',
  avatar_url TEXT,
  department TEXT NOT NULL DEFAULT 'SVYASA Student',
  streak_days INT NOT NULL DEFAULT 1 CHECK (streak_days >= 0),
  last_active_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  streak_bonus TEXT NOT NULL DEFAULT '+1 Day',
  spots_left INT NOT NULL DEFAULT 50 CHECK (spots_left >= 0),
  total_spots INT NOT NULL DEFAULT 50 CHECK (total_spots > 0),
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (spots_left <= total_spots)
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Campus Meetup',
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'SVYASA Campus',
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS streak_bonus TEXT NOT NULL DEFAULT '+1 Day',
  ADD COLUMN IF NOT EXISTS spots_left INT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS total_spots INT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.events ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE TABLE IF NOT EXISTS public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS events_date_idx ON public.events (date);
CREATE INDEX IF NOT EXISTS profiles_streak_days_idx ON public.profiles (streak_days DESC);
CREATE INDEX IF NOT EXISTS rsvps_user_id_idx ON public.rsvps (user_id);

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, department, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), 'Campus Guest'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'department', ''), 'SVYASA Student'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_profile_after_signup ON auth.users;
CREATE TRIGGER create_profile_after_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();

CREATE OR REPLACE FUNCTION public.is_verified_campus_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND is_anonymous = FALSE
      AND email_confirmed_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.join_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL OR NOT public.is_verified_campus_user() THEN
    RAISE EXCEPTION 'A verified email account is required to book an event.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(current_user_id::TEXT || p_event_id::TEXT, 0)
  );

  IF EXISTS (
    SELECT 1 FROM public.rsvps
    WHERE user_id = current_user_id
      AND event_id = p_event_id
      AND status = 'confirmed'
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.events
  SET spots_left = spots_left - 1
  WHERE id = p_event_id
    AND spots_left > 0
    AND date > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This event has no available seats or has already started.';
  END IF;

  INSERT INTO public.rsvps (user_id, event_id, status)
  VALUES (current_user_id, p_event_id, 'confirmed')
  ON CONFLICT (user_id, event_id)
  DO UPDATE SET status = 'confirmed', created_at = NOW()
  WHERE status = 'cancelled';

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  event_starts_at TIMESTAMPTZ;
BEGIN
  IF current_user_id IS NULL OR NOT public.is_verified_campus_user() THEN
    RAISE EXCEPTION 'A verified email account is required to cancel a booking.';
  END IF;

  SELECT date INTO event_starts_at
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF event_starts_at IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  IF event_starts_at <= NOW() + INTERVAL '7 hours' THEN
    RAISE EXCEPTION 'Bookings can only be cancelled more than 7 hours before the event.';
  END IF;

  UPDATE public.rsvps
  SET status = 'cancelled'
  WHERE user_id = current_user_id
    AND event_id = p_event_id
    AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.events
  SET spots_left = LEAST(total_spots, spots_left + 1)
  WHERE id = p_event_id;

  RETURN TRUE;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
DROP POLICY IF EXISTS "Users can create events for themselves" ON public.events;
CREATE POLICY "Events are viewable by everyone"
  ON public.events FOR SELECT USING (TRUE);
CREATE POLICY "Users can create events for themselves"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = organizer_id AND public.is_verified_campus_user() AND date > NOW());

DROP POLICY IF EXISTS "RSVPs are viewable by everyone" ON public.rsvps;
DROP POLICY IF EXISTS "Users can manage RSVPs" ON public.rsvps;
DROP POLICY IF EXISTS "Users can view their own RSVPs" ON public.rsvps;
DROP POLICY IF EXISTS "Authenticated users can view event attendees" ON public.rsvps;
CREATE POLICY "Authenticated users can view event attendees"
  ON public.rsvps FOR SELECT TO authenticated
  USING (TRUE);

GRANT SELECT ON public.profiles, public.events TO anon, authenticated;
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, name, department, avatar_url) ON public.profiles TO authenticated;
GRANT UPDATE (name, department, avatar_url) ON public.profiles TO authenticated;
GRANT INSERT ON public.events TO authenticated;
GRANT SELECT ON public.rsvps TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rsvps FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_verified_campus_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_campus_user() TO authenticated;
REVOKE ALL ON FUNCTION public.join_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_event(UUID) TO authenticated;

INSERT INTO public.events (title, category, date, location, image_url, spots_left, total_spots)
SELECT demo.title, demo.category, demo.event_date, demo.location, demo.image_url, demo.spots_left, demo.total_spots
FROM (VALUES
  (
    'Smart India Hackathon 2026 Internal Pitch',
    'Startup & Pitch',
    NOW() + INTERVAL '13 days',
    'Main Auditorium, SVYASA Campus',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&auto=format&fit=crop&q=80',
    12,
    50
  ),
  (
    'AI & Local LLMs Hands-on Workshop',
    'Tech & Coding',
    NOW() + INTERVAL '16 days',
    'Lab 4, Computer Science Block',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=900&auto=format&fit=crop&q=80',
    24,
    30
  ),
  (
    'Campus Musical Night & Acoustic Jam',
    'Cultural & Arts',
    NOW() + INTERVAL '18 days',
    'Student Open Amphitheatre',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&auto=format&fit=crop&q=80',
    45,
    100
  ),
  (
    'Sunrise Yoga & Wellness Meetup',
    'Sports & Fitness',
    NOW() + INTERVAL '21 days',
    'SVYASA Garden Lawn',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=900&auto=format&fit=crop&q=80',
    36,
    40
  )
) AS demo(title, category, event_date, location, image_url, spots_left, total_spots)
WHERE NOT EXISTS (
  SELECT 1 FROM public.events existing WHERE existing.title = demo.title
);

NOTIFY pgrst, 'reload schema';
