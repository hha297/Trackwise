# Supabase

Schema changes belong in `migrations/` and are applied with the Supabase CLI. Dashboard edits are not the source of truth.

## Email OTP (signup + password recovery)

The app uses **in-app 8-digit OTP** for both signup email verification and forgot-password (not a browser confirm/reset link).

`EMAIL_OTP_LENGTH` in the app must match **Authentication → Sign In / Providers → Email → Email OTP length** (set to `8`).

### Manual dashboard setup (required for hosted projects)

1. **Authentication → Sign In / Providers → Email**
   - **Confirm email**: ON
   - **Email OTP length**: `8`
2. **Authentication → Email Templates → Confirm signup**
   - Subject: `Your Trackwise verification code`
   - Body: paste `templates/confirmation-otp.html` (must include `{{ .Token }}`, must **not** include `{{ .ConfirmationURL }}`).
3. **Authentication → Email Templates → Reset password**
   - Subject: `Your Trackwise password reset code`
   - Body: paste `templates/recovery-otp.html` (must include `{{ .Token }}`, must **not** include `{{ .ConfirmationURL }}`).
4. Save and test signup + forgot-password from the app.

Local `config.toml` already sets `enable_confirmations = true`, `otp_length = 8`, and wires both templates for `supabase start`.

Auth uses Supabase Auth only for password hashing. The mobile client never stores or hashes passwords.

Phase 1 adds `planned_workouts` (template on a local calendar day, or a rest/recovery day) and `hydration_entries` / `hydration_targets` (millilitres, grouped by the diary date). Personal records and progression are calculated from completed `workout_sets`; they are not a separate table. Apply `20261112223000_phase1_planner_hydration.sql` before using the week plan or water log. The migration is not applied to hosted production from the app repo automatically.

When a user-owned table is added:

1. Add a SQL migration in `migrations/`.
2. Enable row level security in that migration.
3. Add policies that limit rows to the signed-in user (`auth.uid()`).
4. Grant only the privileges the app needs.

Do not put the service-role key, database password, or other secrets in the mobile app or in this directory.

`functions/` is for Edge Functions that must run with server-only credentials. `seed/` is for local development data.

## Admin dashboard roles

Migration `20261102220000_admin_roles_and_security.sql` adds `user_roles`, account status, catalog `archived_at`, audit logs, feature flags, and admin RLS/RPCs. Bootstrap the first admin with `select public.admin_bootstrap_grant('<user_uuid>');` as service_role/postgres (see `admin/README.md`). The Admin Next.js app lives in `/admin`.

## Account deletion

`functions/delete-account` deletes the authenticated Auth user (Postgres cascades wipe owned rows). Deploy with JWT verification enabled:

```bash
npx supabase functions deploy delete-account
```

The mobile app calls it with the user session; the function uses the service role only on the server.

## Profile avatar

Migration `20261029210000_profile_avatar.sql` adds `profiles.avatar_url` (HTTPS URL). Images are uploaded via the same unsigned Cloudinary preset as food photos (`trackwise/avatars` folder).
