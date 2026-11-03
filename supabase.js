const SUPABASE_URL = 'https://feoiitkowjxrbtvakiyn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mIwEGF7tfIlteX0JwWEHzw_EqMbauZp';

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const SupabaseAPI = {
  userId: null,

  isStaleAnonymousSessionError(error) {
    const message = `${error?.message || ''} ${error?.details || ''}`;
    return error?.code === '23503'
      || error?.code === 'PGRST301'
      || error?.code === 'PGRST303'
      || /user from sub claim.*does not exist|profiles_id_fkey/i.test(message);
  },

  get client() {
    if (!supabaseClient) {
      throw new Error('The Supabase JavaScript client did not load.');
    }
    return supabaseClient;
  },

  async initialize() {
    const client = this.client;
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    let user = sessionData.session?.user;
    if (user) {
      const { data: verifiedUser, error: userError } = await client.auth.getUser();
      if (userError) {
        if (!user.is_anonymous
          || (userError.status !== 401 && !this.isStaleAnonymousSessionError(userError))) {
          throw userError;
        }

        const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
        user = null;
      } else {
        user = verifiedUser.user;
      }
    }

    if (!user) {
      const { data, error } = await client.auth.signInAnonymously({
        options: {
          data: {
            name: 'Campus Guest',
            department: 'SVYASA Student'
          }
        }
      });
      if (error?.code === 'anonymous_provider_disabled') return null;
      if (error) throw error;
      user = data.user;
    }

    if (!user) throw new Error('Supabase did not return a signed-in user.');
    this.userId = user.id;

    try {
      return await this.getOrCreateProfile(client, user);
    } catch (error) {
      if (!user.is_anonymous || !this.isStaleAnonymousSessionError(error)) throw error;

      const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;

      const { data, error: signInError } = await client.auth.signInAnonymously({
        options: {
          data: {
            name: 'Campus Guest',
            department: 'SVYASA Student'
          }
        }
      });
      if (signInError) throw signInError;
      if (!data.user) throw new Error('Supabase did not create a replacement guest session.');

      this.userId = data.user.id;
      return this.getOrCreateProfile(client, data.user);
    }
  },

  async getOrCreateProfile(client, user) {
    const { data: existingProfile, error: profileError } = await client
      .from('profiles')
      .select('id, name, department, streak_days, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (existingProfile) return existingProfile;

    const { data: createdProfile, error: createError } = await client
      .from('profiles')
      .insert({
        id: user.id,
        name: user.user_metadata?.name || 'Campus Guest',
        department: user.user_metadata?.department || 'SVYASA Student',
        avatar_url: user.user_metadata?.avatar_url || null
      })
      .select('id, name, department, streak_days, avatar_url')
      .single();
    if (createError) throw createError;
    return createdProfile;
  },

  async getCurrentUser() {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw error;
    this.userId = data.user?.id || null;
    return data.user;
  },

  async getEvents() {
    const client = this.client;
    const { data: events, error } = await client
      .from('events')
      .select('id, title, category, date, location, image_url, spots_left, total_spots')
      .gt('date', new Date().toISOString())
      .order('date', { ascending: true })
      .limit(100);
    if (error) throw error;

    let rsvps = [];
    if (this.userId) {
      const { data, error: rsvpError } = await client
        .from('rsvps')
        .select('event_id, status, profiles(id, name, avatar_url)')
        .eq('status', 'confirmed');
      if (rsvpError) throw rsvpError;
      rsvps = data;
    }

    const attendeesByEvent = new Map();
    const joinedEventIds = new Set();
    for (const rsvp of rsvps) {
      const attendees = attendeesByEvent.get(rsvp.event_id) || [];
      if (rsvp.profiles) attendees.push(rsvp.profiles);
      attendeesByEvent.set(rsvp.event_id, attendees);
      if (rsvp.event_id && rsvp.profiles?.id === this.userId) joinedEventIds.add(rsvp.event_id);
    }

    const seenEvents = new Set();
    return events
      .filter((event) => {
        const duplicateKey = `${event.title.trim().toLocaleLowerCase()}|${new Date(event.date).getTime()}|${event.location.trim().toLocaleLowerCase()}`;
        if (seenEvents.has(duplicateKey)) return false;
        seenEvents.add(duplicateKey);
        return true;
      })
      .map((event) => ({
        ...event,
        image: event.image_url,
        joined: joinedEventIds.has(event.id),
        attendees: attendeesByEvent.get(event.id) || []
      }));
  },

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.userId = data.user.id;
    return data.user;
  },

  async sendPasswordReset(email) {
    const redirectTo = /^https?:$/.test(window.location.protocol)
      ? new URL('.', window.location.href).href
      : undefined;
    const { error } = await this.client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) throw error;
  },

  async resendVerification(email) {
    const redirectTo = /^https?:$/.test(window.location.protocol)
      ? new URL('.', window.location.href).href
      : undefined;
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email,
      ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {})
    });
    if (error) throw error;
  },

  async createAccount({ name, department, email, password }) {
    const client = this.client;
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    const metadata = { name, department };
    const redirectUrl = /^https?:$/.test(window.location.protocol)
      ? new URL('.', window.location.href).href
      : undefined;

    if (sessionData.session) {
      const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        ...(redirectUrl ? { emailRedirectTo: redirectUrl } : {})
      }
    });
    if (error) throw error;

    const user = data.user;
    const session = data.session;
    if (!user) throw new Error('Supabase did not create an account.');

    if (user.identities?.length === 0) {
      return {
        user,
        accountAlreadyExists: true,
        emailVerificationRequired: false,
        session: null
      };
    }

    if (!session) {
      return {
        user,
        emailVerificationRequired: !user.email_confirmed_at,
        session: null
      };
    }

    this.userId = user.id;
    await this.getOrCreateProfile(client, user);

    return {
      user,
      emailVerificationRequired: !user.email_confirmed_at,
      session
    };
  },

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
    this.userId = null;
  },

  async assertVerifiedUser() {
    const user = await this.getCurrentUser();
    if (!user || user.is_anonymous || !user.email || !user.email_confirmed_at) {
      throw new Error('Sign in with a verified email before booking or hosting events.');
    }
    return user;
  },

  async joinEvent(eventId) {
    await this.assertVerifiedUser();
    const { data, error } = await this.client.rpc('join_event', {
      p_event_id: eventId
    });
    if (error) throw error;
    return data;
  },

  async cancelEvent(eventId) {
    await this.assertVerifiedUser();
    const { data, error } = await this.client.rpc('cancel_event', {
      p_event_id: eventId
    });
    if (error) throw error;
    return data;
  },

  async createEvent(eventData) {
    const user = await this.assertVerifiedUser();
    const { data, error } = await this.client
      .from('events')
      .insert({ ...eventData, organizer_id: user.id })
      .select('id, title, category, date, location, image_url, spots_left, total_spots')
      .single();
    if (error) throw error;
    return { ...data, image: data.image_url, joined: false, attendees: [] };
  },

  async getStreakLeaderboard() {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, name, department, streak_days, avatar_url')
      .order('streak_days', { ascending: false })
      .order('name', { ascending: true })
      .limit(10);
    if (error) throw error;
    return data;
  }
};
