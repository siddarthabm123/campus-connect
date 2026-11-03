# CampusConnect

CampusConnect is a campus event discovery and RSVP frontend backed by Supabase.

## File Structure
- `index.html`: Main single-page application layout with tab views.
- `styles.css`: Custom animations and scrollbar styling.
- `supabase.js`: Supabase JS client configuration and API helper functions.
- `app.js`: Interactive UI logic, local state fallback, and tab switching.
- `schema.sql`: PostgreSQL database schema for Supabase tables and RLS policies.

## Supabase setup

1. Run `schema.sql` in the Supabase SQL Editor. It creates/updates the profile, event, and RSVP tables, their access policies, a transactional event-join function, and sample upcoming events. The migration adds the UI-required columns to the existing `events` table.
2. Keep **Allow anonymous sign-ins** enabled for guest browsing. Event booking and hosting require a permanent account with a verified email address.
3. If email confirmation is enabled, add the app's local and deployed URLs under **Authentication → URL Configuration → Redirect URLs**. Use an HTTP local server such as VS Code Live Server, not a `file://` URL, for verification links.
4. `supabase.js` is configured with this project's URL and publishable key. Publishable keys are intended for browser use; never put a `service_role` or secret key in frontend code.
5. Serve `index.html` through a local static web server or deploy it to a static host. Open the browser console if the connection status banner reports an error.

### Email signup limits

Supabase's built-in email sender is for development: it currently allows only 2 emails per hour and only sends to authorized project team addresses. An `email rate limit exceeded` error means Supabase could not send the confirmation email; it does not prove whether the Auth user was created. See Supabase's [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) and [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) docs for current limits and provider setup.

1. In **Authentication → Users**, check whether the email address already has a user and whether it is confirmed. Do not repeatedly submit signup or resend requests while the project is rate-limited.
2. Configure a custom SMTP provider in **Authentication → SMTP Settings** (for example, Resend, Brevo, or SendGrid). Verify the sender/domain with that provider. Keep SMTP credentials in Supabase settings only; never add them to frontend files or share them in chat.
3. If the user exists and is confirmed, sign in. If the user exists but is unconfirmed, request one verification email after SMTP is working. If no user exists, submit signup once after SMTP is working.

The Explore Hub has confirmed bookings, cancellation controls, and attendee lists. Event discovery has search, category filters, sorting, and pagination. Booking requires reviewing the terms and confirmation; cancellation is allowed only more than seven hours before the event. The SQL RPC checks identity, capacity, and the cancellation deadline again on the server.

The database schema and seed SQL are included in this repository; apply schema changes in the Supabase dashboard before using the updated booking/account features.
