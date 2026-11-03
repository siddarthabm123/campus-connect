const fallbackImage = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&auto=format&fit=crop&q=80';
const PAGE_SIZE = 9;
const CANCEL_CUTOFF_HOURS = 7;

let eventsState = [];
let leaderboardState = [];
let currentProfile = null;
let currentUser = null;
let currentCategory = 'all';
let currentPage = 1;
let selectedBookingId = null;
let selectedCancellationId = null;
let accountMode = 'signin';
let supabaseReady = false;
let canInteract = false;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function showStatus(message, type = 'info') {
  const status = document.getElementById('app-status');
  if (!status) return;
  status.textContent = message;
  status.classList.remove('hidden', 'border-rose-500/30', 'bg-rose-500/10', 'text-rose-200', 'border-emerald-500/30', 'bg-emerald-500/10', 'text-emerald-200', 'border-sky-500/30', 'bg-sky-500/10', 'text-sky-200');
  const style = type === 'error'
    ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
    : type === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : 'border-sky-500/30 bg-sky-500/10 text-sky-200';
  status.classList.add(...style.split(' '));
}

function setFormError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');
}

function clearFormError(elementId) {
  const element = document.getElementById(elementId);
  element.textContent = '';
  element.classList.add('hidden');
}

function switchTab(tabName) {
  document.querySelectorAll('.view-content').forEach((view) => view.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.className = 'nav-tab px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center space-x-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50';
  });

  const activeView = document.getElementById(`view-${tabName}`);
  const activeNav = document.getElementById(`nav-${tabName}`);
  if (activeView) activeView.classList.remove('hidden');
  if (activeNav) {
    activeNav.className = 'nav-tab px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center space-x-2 text-sky-400 bg-sky-500/10 border border-sky-500/20 shadow-sm shadow-sky-500/10';
  }
}

function formatEventDate(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options
  });
}

function cancelAllowed(event) {
  return new Date(event.date).getTime() - Date.now() > CANCEL_CUTOFF_HOURS * 60 * 60 * 1000;
}

function renderAttendees(attendees = [], limit = 4) {
  if (attendees.length === 0) {
    return '<span class="text-[11px] text-slate-500">Be the first to book this event.</span>';
  }
  const faces = attendees.slice(0, limit).map((attendee) => `
    <img src="${escapeHTML(attendee.avatar_url || fallbackImage)}" alt="${escapeHTML(attendee.name)}" title="${escapeHTML(attendee.name)}" class="h-7 w-7 rounded-full border-2 border-slate-900 object-cover" />
  `).join('');
  const additional = attendees.length > limit ? `<span class="text-[11px] text-slate-400">+${attendees.length - limit}</span>` : '';
  const names = attendees.slice(0, limit).map((attendee) => escapeHTML(attendee.name)).join(', ');
  return `<div class="flex items-center gap-1"><div class="flex -space-x-2">${faces}</div>${additional}<span class="ml-1 truncate text-[11px] text-slate-400" title="${names}">${attendees.length} attending</span></div>`;
}

function renderEventCards(containerId, eventsList) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (eventsList.length === 0) {
    container.innerHTML = '<p class="col-span-full py-10 text-center text-sm text-slate-400">No matching upcoming events. Try another category or search.</p>';
    return;
  }

  container.innerHTML = eventsList.map((item) => {
    const joined = item.joined;
    const isFull = item.spots_left <= 0;
    const actionLabel = joined
      ? 'Booked'
      : isFull
        ? 'Full'
        : canInteract
          ? 'Review & book'
          : 'Sign in to book';
    const actionStyle = joined
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
      : isFull || !canInteract
        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20';
    const dateLabel = formatEventDate(item.date);

    return `
      <article class="event-card flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 transition-all hover:border-slate-700">
        <div>
          <div class="relative h-40">
            <img src="${escapeHTML(item.image || item.image_url || fallbackImage)}" class="h-full w-full object-cover" alt="${escapeHTML(item.title)}" loading="lazy" />
            <span class="absolute left-3 top-3 rounded-full border border-sky-500/30 bg-slate-950/80 px-3 py-1 text-[10px] font-bold text-sky-400 backdrop-blur-md">${escapeHTML(item.category)}</span>
          </div>
          <div class="space-y-3 p-5">
            <h3 class="text-base font-bold leading-snug text-white">${escapeHTML(item.title)}</h3>
            <div class="space-y-1 text-xs text-slate-400">
              <div class="flex items-center gap-2"><i class="fa-solid fa-location-dot w-4 text-sky-400"></i><span>${escapeHTML(item.location)}</span></div>
              <div class="flex items-center gap-2"><i class="fa-solid fa-clock w-4 text-sky-400"></i><span>${escapeHTML(dateLabel)}</span></div>
            </div>
            <div class="attendee-list">${renderAttendees(item.attendees)}</div>
          </div>
        </div>
        <div class="flex items-center justify-between gap-3 p-5 pt-0">
          <span class="text-xs font-semibold ${item.spots_left < 5 ? 'text-rose-400' : 'text-slate-400'}">
            <i class="fa-solid fa-user-group mr-1 text-xs"></i>${escapeHTML(item.spots_left)} of ${escapeHTML(item.total_spots)} seats
          </span>
          <button type="button" data-event-id="${escapeHTML(item.id)}" ${joined ? 'disabled' : ''} class="join-event-button rounded-xl px-4 py-2 text-xs font-bold transition-all ${actionStyle}">${actionLabel}</button>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.join-event-button:not(:disabled)').forEach((button) => {
    button.addEventListener('click', () => handleJoin(button.dataset.eventId));
  });
}

function renderBookings() {
  const container = document.getElementById('my-bookings-container');
  const bookings = eventsState.filter((event) => event.joined);
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
        <i class="fa-solid fa-ticket mb-3 text-2xl text-slate-500"></i>
        <p class="text-sm font-semibold text-slate-300">${canInteract ? 'No upcoming bookings yet.' : 'Sign in with a verified email to manage bookings.'}</p>
        <p class="mt-1 text-xs text-slate-500">Your confirmed events and fellow attendees will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = bookings.map((event) => {
    const canCancel = cancelAllowed(event);
    return `
      <article class="flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-slate-900/70 p-4 sm:flex-row sm:items-center">
        <div class="min-w-0 flex-1">
          <div class="mb-1 flex flex-wrap items-center gap-2">
            <h3 class="font-bold text-white">${escapeHTML(event.title)}</h3>
            <span class="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">CONFIRMED</span>
          </div>
          <p class="text-xs text-slate-400">${escapeHTML(formatEventDate(event.date))} · ${escapeHTML(event.location)}</p>
          <div class="mt-3">${renderAttendees(event.attendees, 6)}</div>
        </div>
        <div class="flex flex-col items-start gap-2 sm:items-end">
          <button type="button" data-cancel-event-id="${escapeHTML(event.id)}" ${canCancel ? '' : 'disabled'} class="cancel-event-button rounded-xl border px-3 py-2 text-xs font-semibold ${canCancel ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10' : 'cursor-not-allowed border-slate-700 text-slate-500'}">${canCancel ? 'Cancel booking' : 'Cancellation closed'}</button>
          <span class="text-[10px] text-slate-500">${canCancel ? 'Cancel more than 7 hours before start' : 'Attendance commitment active'}</span>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.cancel-event-button:not(:disabled)').forEach((button) => {
    button.addEventListener('click', () => openCancellation(button.dataset.cancelEventId));
  });
}

function renderLeaderboard() {
  const podium = document.getElementById('leaderboard-podium');
  const list = document.getElementById('leaderboard-list');
  if (!podium || !list) return;

  if (leaderboardState.length === 0) {
    podium.innerHTML = '';
    list.innerHTML = '<p class="p-6 text-center text-sm text-slate-400">No student streaks to display yet.</p>';
    return;
  }

  const rankedProfiles = leaderboardState.slice().sort((a, b) => b.streak_days - a.streak_days);
  const podiumOrder = [rankedProfiles[1], rankedProfiles[0], rankedProfiles[2]].filter(Boolean);
  podium.innerHTML = podiumOrder.map((profile) => {
    const rank = rankedProfiles.indexOf(profile) + 1;
    return `
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center ${rank === 1 ? 'sm:-translate-y-4' : ''}">
        <img src="${escapeHTML(profile.avatar_url || fallbackImage)}" alt="${escapeHTML(profile.name)}" class="mx-auto mb-3 h-14 w-14 rounded-2xl object-cover" />
        <div class="text-[10px] font-bold uppercase tracking-wider text-amber-300">#${rank}</div>
        <div class="mt-1 truncate text-xs font-bold text-white">${escapeHTML(profile.name)}</div>
        <div class="mt-1 text-xs text-slate-400">${escapeHTML(profile.streak_days)} day streak</div>
      </div>
    `;
  }).join('');

  list.innerHTML = rankedProfiles.map((profile, index) => `
    <div class="flex items-center gap-4 p-4">
      <span class="w-7 text-center text-xs font-bold text-slate-400">#${index + 1}</span>
      <img src="${escapeHTML(profile.avatar_url || fallbackImage)}" alt="${escapeHTML(profile.name)}" class="h-10 w-10 rounded-xl object-cover" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-bold text-white">${escapeHTML(profile.name)}</div>
        <div class="truncate text-xs text-slate-400">${escapeHTML(profile.department || 'SVYASA Student')}</div>
      </div>
      <div class="text-xs font-bold text-amber-300"><i class="fa-solid fa-fire mr-1"></i>${escapeHTML(profile.streak_days)} days</div>
    </div>
  `).join('');
}

function updateProfileUI() {
  const name = currentProfile?.name || 'Campus Guest';
  const department = currentProfile?.department || (currentUser?.email || 'Guest session');
  const streak = Number(currentProfile?.streak_days) || 0;
  const rank = currentProfile
    ? leaderboardState.findIndex((profile) => profile.id === currentProfile.id)
    : -1;

  document.getElementById('header-user-name').textContent = name;
  document.getElementById('header-user-department').textContent = department;
  document.getElementById('header-avatar').src = currentProfile?.avatar_url || fallbackImage;
  document.getElementById('header-streak-val').textContent = `${streak} ${streak === 1 ? 'Day' : 'Days'}`;
  document.getElementById('welcome-title').textContent = `Welcome back, ${name}!`;
  document.getElementById('dash-streak-days').textContent = `${streak} ${streak === 1 ? 'Day' : 'Days'}`;
  document.getElementById('dash-my-events-count').textContent = `${eventsState.filter((event) => event.joined).length} Booked`;
  document.getElementById('dash-leaderboard-rank').textContent = rank < 0 ? '— Rank' : `#${rank + 1} Rank`;
  const accountButton = document.getElementById('account-button');
  accountButton.textContent = canInteract ? 'Account' : 'Sign in';
  accountButton.setAttribute('aria-label', canInteract ? 'Account settings and sign out' : 'Sign in or create account');
}

function getVisibleEvents() {
  const search = document.getElementById('event-search').value.trim().toLocaleLowerCase();
  const sortBy = document.getElementById('event-sort').value;
  const filtered = eventsState.filter((event) => {
    const matchesCategory = currentCategory === 'all' || event.category === currentCategory;
    const text = `${event.title} ${event.location} ${event.category}`.toLocaleLowerCase();
    return matchesCategory && (!search || text.includes(search));
  });
  if (sortBy === 'seats') filtered.sort((a, b) => b.spots_left - a.spots_left);
  else filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  return filtered;
}

function renderEventBrowser() {
  const visibleEvents = getVisibleEvents();
  const pageCount = Math.max(1, Math.ceil(visibleEvents.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  renderEventCards('events-list-container', visibleEvents.slice(start, start + PAGE_SIZE));
  document.getElementById('event-results-count').textContent = `${visibleEvents.length} upcoming ${visibleEvents.length === 1 ? 'event' : 'events'} found`;
  document.getElementById('events-page-label').textContent = `Page ${currentPage} of ${pageCount}`;
  document.getElementById('events-previous').disabled = currentPage <= 1;
  document.getElementById('events-next').disabled = currentPage >= pageCount;
}

function renderAllEvents() {
  const recommendations = eventsState.filter((event) => !event.joined).slice(0, 3);
  renderBookings();
  renderEventCards('dash-events-container', recommendations);
  renderEventBrowser();
  updateProfileUI();
}

async function refreshEvents() {
  eventsState = await SupabaseAPI.getEvents();
  renderAllEvents();
}

function showAccountDialog(mode = 'signin') {
  const dialog = document.getElementById('account-dialog');
  const isVerified = canInteract;
  accountMode = mode;
  clearFormError('account-form-error');

  document.getElementById('account-mode-switch').classList.toggle('hidden', isVerified);
  document.getElementById('account-name-field').classList.toggle('hidden', mode !== 'signup' || isVerified);
  document.getElementById('account-department-field').classList.toggle('hidden', mode !== 'signup' || isVerified);
  document.getElementById('account-recovery-actions').classList.toggle('hidden', mode !== 'signin' || isVerified);
  document.getElementById('account-recovery-actions').classList.toggle('flex', mode === 'signin' && !isVerified);
  document.getElementById('account-name').required = mode === 'signup' && !isVerified;
  document.getElementById('account-department').required = mode === 'signup' && !isVerified;
  document.getElementById('account-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  document.getElementById('account-password').minLength = mode === 'signup' ? 8 : 1;
  document.getElementById('account-dialog-title').textContent = isVerified ? 'Your account' : mode === 'signup' ? 'Create your account' : 'Sign in';
  document.getElementById('account-dialog-description').textContent = isVerified
    ? `Signed in as ${currentUser.email}.`
    : 'A verified email is required to book or host campus events.';
  document.getElementById('account-submit').classList.toggle('hidden', isVerified);
  document.getElementById('account-submit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  document.getElementById('account-signout').classList.toggle('hidden', !isVerified);
  document.querySelectorAll('.account-mode-btn').forEach((button) => {
    const active = button.dataset.accountMode === mode;
    button.className = active
      ? 'account-mode-btn flex-1 rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950'
      : 'account-mode-btn flex-1 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300';
  });
  if (!dialog.open) dialog.showModal();
}

function showBookingDialog(eventId) {
  const item = eventsState.find((event) => event.id === eventId);
  if (!item || item.joined || item.spots_left <= 0) return;
  selectedBookingId = eventId;
  clearFormError('booking-form-error');
  document.getElementById('booking-terms').checked = false;
  document.getElementById('booking-event-summary').innerHTML = `
    <h3 class="font-bold text-white">${escapeHTML(item.title)}</h3>
    <p class="mt-2 text-xs text-slate-400">${escapeHTML(formatEventDate(item.date))}</p>
    <p class="mt-1 text-xs text-slate-400">${escapeHTML(item.location)} · ${escapeHTML(item.spots_left)} seats remain</p>
    <div class="mt-3">${renderAttendees(item.attendees)}</div>
  `;
  document.getElementById('booking-dialog').showModal();
}

function openCancellation(eventId) {
  const item = eventsState.find((event) => event.id === eventId);
  if (!item || !item.joined) return;
  if (!cancelAllowed(item)) {
    showStatus('Cancellation closes 7 hours before the event starts.', 'error');
    return;
  }
  selectedCancellationId = eventId;
  clearFormError('cancel-form-error');
  document.getElementById('cancel-event-summary').textContent = `${item.title} · ${formatEventDate(item.date)}`;
  document.getElementById('cancel-dialog').showModal();
}

async function handleJoin(eventId) {
  const item = eventsState.find((event) => event.id === eventId);
  if (!item || item.joined || item.spots_left <= 0) return;
  if (!canInteract) {
    showStatus('Sign in with a verified email to book a spot.', 'info');
    showAccountDialog('signin');
    return;
  }
  showBookingDialog(eventId);
}

function filterEvents(category) {
  currentCategory = category;
  currentPage = 1;
  document.querySelectorAll('#category-filters .cat-btn').forEach((button) => {
    const active = button.dataset.category === category;
    button.className = active
      ? 'cat-btn rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950'
      : 'cat-btn rounded-xl border border-slate-800 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white';
  });
  renderEventBrowser();
}

document.getElementById('account-button').addEventListener('click', () => {
  showAccountDialog('signin');
});

document.querySelectorAll('.account-mode-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById('account-dialog').close();
    showAccountDialog(button.dataset.accountMode);
  });
});

document.getElementById('account-close').addEventListener('click', () => document.getElementById('account-dialog').close());

document.getElementById('forgot-password-button').addEventListener('click', async () => {
  clearFormError('account-form-error');
  const emailInput = document.getElementById('account-email');
  const email = emailInput.value.trim();
  if (!email || !emailInput.checkValidity()) {
    setFormError('account-form-error', 'Enter your account email above, then request a password reset.');
    emailInput.focus();
    return;
  }
  try {
    await SupabaseAPI.sendPasswordReset(email);
    document.getElementById('account-dialog').close();
    showStatus(`If an account exists for ${email}, Supabase will send a password reset link.`, 'success');
  } catch (error) {
    console.error('Password reset request failed:', error);
    setFormError('account-form-error', error.message || 'Could not send the password reset email.');
  }
});

document.getElementById('resend-verification-button').addEventListener('click', async () => {
  clearFormError('account-form-error');
  const emailInput = document.getElementById('account-email');
  const email = emailInput.value.trim();
  if (!email || !emailInput.checkValidity()) {
    setFormError('account-form-error', 'Enter the email address you used to register.');
    emailInput.focus();
    return;
  }
  try {
    await SupabaseAPI.resendVerification(email);
    document.getElementById('account-dialog').close();
    showStatus(`If ${email} is awaiting verification, Supabase will send a new confirmation email.`, 'success');
  } catch (error) {
    console.error('Verification resend failed:', error);
    setFormError('account-form-error', error.message || 'Could not resend the verification email.');
  }
});

document.getElementById('account-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormError('account-form-error');
  const submitButton = document.getElementById('account-submit');
  submitButton.disabled = true;
  submitButton.textContent = 'Please wait…';

  try {
    const email = document.getElementById('account-email').value.trim();
    const password = document.getElementById('account-password').value;
    if (accountMode === 'signup') {
      const result = await SupabaseAPI.createAccount({
        name: document.getElementById('account-name').value.trim(),
        department: document.getElementById('account-department').value.trim() || 'SVYASA Student',
        email,
        password
      });
      if (result.accountAlreadyExists) {
        setFormError('account-form-error', 'This email already has an account. Choose Sign in. If you have not verified it yet, check your inbox for the confirmation email.');
        return;
      }
      document.getElementById('account-dialog').close();
      if (result.emailVerificationRequired) {
        showStatus(`Account created in Supabase Auth. Check ${email} for the verification link, then return here and sign in.`, 'success');
      } else {
        showStatus('Account created in Supabase Auth. Signing you in…', 'success');
        window.location.reload();
      }
    } else {
      await SupabaseAPI.signIn(email, password);
      window.location.reload();
    }
  } catch (error) {
    console.error('Account action failed:', error);
    const message = error.message || 'Account request failed. Please try again.';
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('email rate limit')) {
      setFormError(
        'account-form-error',
        'Supabase could not send the confirmation email because the project reached its email sending limit. The signup may still have created a user, so do not retry signup or resend yet. In Supabase Dashboard → Authentication → Users, check whether this email is listed and confirmed. Configure custom SMTP under Authentication → SMTP Settings first. Then, if the user exists but is unconfirmed, resend once; if no user exists, create the account once; if confirmed, switch to Sign in.'
      );
    } else if (lowerMessage.includes('email not confirmed')) {
      setFormError(
        'account-form-error',
        'This account exists but its email is not confirmed. Check your inbox for the verification link. If the project email limit was reached, configure custom SMTP in Supabase before requesting another verification email.'
      );
    } else if (lowerMessage.includes('invalid login credentials')) {
      setFormError(
        'account-form-error',
        'Supabase did not accept this email and password. If signup recently showed an email rate limit error, check Authentication → Users in Supabase Dashboard because the user may still exist. If the user is confirmed, check the password or use Forgot password; if unconfirmed, configure SMTP before resending verification.'
      );
    } else {
      const guidance = lowerMessage.includes('redirect') && lowerMessage.includes('allowed')
        ? ' Add this app URL to Supabase Authentication → URL Configuration → Redirect URLs.'
        : '';
      setFormError('account-form-error', `${message}${guidance}`);
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = accountMode === 'signup' ? 'Create account' : 'Sign in';
  }
});

document.getElementById('account-signout').addEventListener('click', async () => {
  try {
    await SupabaseAPI.signOut();
    window.location.reload();
  } catch (error) {
    console.error('Sign out failed:', error);
    setFormError('account-form-error', error.message || 'Could not sign out.');
  }
});

document.getElementById('booking-close').addEventListener('click', () => document.getElementById('booking-dialog').close());

document.getElementById('booking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormError('booking-form-error');
  const item = eventsState.find((entry) => entry.id === selectedBookingId);
  if (!item) {
    setFormError('booking-form-error', 'This event is no longer available. Refresh the event list and try again.');
    return;
  }

  const submitButton = document.getElementById('booking-submit');
  submitButton.disabled = true;
  submitButton.textContent = 'Checking availability…';
  try {
    const joined = await SupabaseAPI.joinEvent(item.id);
    await refreshEvents();
    document.getElementById('booking-dialog').close();
    selectedBookingId = null;
    showStatus(joined ? 'Your booking is confirmed. See the attendees in Explore Hub.' : 'You already have an active booking for this event.', joined ? 'success' : 'info');
  } catch (error) {
    console.error('Booking could not be completed:', error);
    setFormError('booking-form-error', error.message || 'Booking failed. Refresh the events and try again.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Confirm booking';
  }
});

document.getElementById('booking-dialog').addEventListener('close', () => {
  selectedBookingId = null;
});

document.getElementById('cancel-keep-button').addEventListener('click', () => document.getElementById('cancel-dialog').close());

document.getElementById('cancel-confirm-button').addEventListener('click', async () => {
  clearFormError('cancel-form-error');
  const event = eventsState.find((item) => item.id === selectedCancellationId);
  if (!event || !cancelAllowed(event)) {
    setFormError('cancel-form-error', 'The 7-hour cancellation window has closed.');
    return;
  }
  const button = document.getElementById('cancel-confirm-button');
  button.disabled = true;
  button.textContent = 'Cancelling…';
  try {
    const cancelled = await SupabaseAPI.cancelEvent(event.id);
    await refreshEvents();
    document.getElementById('cancel-dialog').close();
    showStatus(cancelled ? 'Booking cancelled and the seat released.' : 'This booking was already cancelled.', cancelled ? 'success' : 'info');
  } catch (error) {
    console.error('Cancellation failed:', error);
    setFormError('cancel-form-error', error.message || 'Could not cancel this booking.');
  } finally {
    button.disabled = false;
    button.textContent = 'Cancel spot';
  }
});

document.getElementById('event-search').addEventListener('input', () => {
  currentPage = 1;
  renderEventBrowser();
});

document.getElementById('event-sort').addEventListener('change', () => {
  currentPage = 1;
  renderEventBrowser();
});

document.getElementById('events-previous').addEventListener('click', () => {
  currentPage = Math.max(1, currentPage - 1);
  renderEventBrowser();
});

document.getElementById('events-next').addEventListener('click', () => {
  currentPage += 1;
  renderEventBrowser();
});

document.getElementById('create-event-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!canInteract) {
    showStatus('Sign in with a verified email before hosting an event.', 'info');
    showAccountDialog('signin');
    return;
  }

  const seats = Number(document.getElementById('event-seats').value);
  const dateValue = document.getElementById('event-date').value;
  const timeValue = document.getElementById('event-time').value;
  const eventDate = new Date(`${dateValue}T${timeValue}`);
  if (!Number.isInteger(seats) || seats < 1 || seats > 500 || !dateValue || !timeValue || Number.isNaN(eventDate.getTime()) || eventDate <= new Date()) {
    showStatus('Choose a valid future date and time, and enter between 1 and 500 seats.', 'error');
    return;
  }

  const newEvent = {
    title: document.getElementById('event-title').value.trim(),
    category: document.getElementById('event-category').value,
    spots_left: seats,
    total_spots: seats,
    location: document.getElementById('event-location').value.trim(),
    date: eventDate.toISOString(),
    image_url: fallbackImage
  };

  try {
    await SupabaseAPI.createEvent(newEvent);
    await refreshEvents();
    event.target.reset();
    document.getElementById('event-seats').value = '50';
    setDefaultEventDate();
    showStatus('Event successfully published.', 'success');
    switchTab('events');
  } catch (error) {
    console.error('Could not create event:', error);
    showStatus(`Could not publish event: ${error.message}`, 'error');
  }
});

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setDefaultEventDate() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  document.getElementById('event-date').min = localDateValue(now);
  document.getElementById('event-date').value = localDateValue(tomorrow);
  document.getElementById('event-time').value = '10:00';
}

document.addEventListener('DOMContentLoaded', async () => {
  setDefaultEventDate();
  try {
    currentProfile = await SupabaseAPI.initialize();
    currentUser = await SupabaseAPI.getCurrentUser();
    [eventsState, leaderboardState] = await Promise.all([
      SupabaseAPI.getEvents(),
      SupabaseAPI.getStreakLeaderboard()
    ]);
    supabaseReady = true;
    canInteract = Boolean(currentProfile && currentUser && !currentUser.is_anonymous && currentUser.email_confirmed_at);
    renderAllEvents();
    renderLeaderboard();
    if (currentUser?.is_anonymous) {
      showStatus('You are browsing as a guest. Create an account and verify your email to book or host events.', 'info');
    } else if (currentUser && !currentUser.email_confirmed_at) {
      showStatus('Verify your email address before booking or hosting events.', 'info');
    }
  } catch (error) {
    console.error('Could not initialize Supabase:', error);
    renderAllEvents();
    renderLeaderboard();
    showStatus(`Supabase could not load live data. ${error.message}`, 'error');
  }
});
