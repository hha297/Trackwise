Trackwise — agent instructions
Purpose and scope
Trackwise is a mobile-first nutrition and fitness app for food logging, calories, workouts, goals, body measurements, and progress. Treat calorie and activity values as estimates, not medical measurements.

The Admin web console lives in `admin/` (own package + lockfile). Read `admin/AGENTS.md` and `admin/README.md` before changing Admin auth, roles, catalog writes, or deployments.

The public marketing site (main web for trackwise.one) lives in `dashboard/` (own package + lockfile). Read `dashboard/AGENTS.md` and `dashboard/README.md` before changing public site content, SEO, legal drafts, or store/download configuration. This is not the Admin console (`admin/`).

These instructions apply throughout the repository. Read any more specific AGENTS.md in the area being changed. Follow the user's current requirements; this file supplies project defaults, not permission to expand a task.
Start every task with the actual checkout

- Read the relevant code, package.json, lockfile, configuration, and nearby tests before editing. Inspect git status and preserve unrelated work.
- Use the current checkout as evidence. Do not assume that a feature, dependency, migration, or external provider is configured because it was discussed previously.
- Follow existing patterns when they fit. Do not treat a bug, stale comment, or duplicated implementation as a requirement to reproduce.
- Ask when conflicting requirements would change product behavior, data compatibility, or architecture. Make routine implementation choices independently and explain material assumptions.
- Keep changes focused. Do not bundle redesigns, dependency upgrades, broad formatting, or unrelated fixes into a task.
  Sources of truth
- Runtime dependencies and available commands: package.json and the checked-in lockfile.
- Routes and access guards: app/ and src/features/bootstrap/.
- Design implementation: src/theme/, src/components/ui/, and the relevant feature components.
- Database history: supabase/migrations/. Local service settings: supabase/config.toml. Auth email templates: supabase/templates/.
- Setup and operational guidance: README.md and supabase/README.md, checked against the actual code and configuration.
- DESIGN.MD documents the current Trackwise visual system: Replicate-inspired typography-led UI with locked Trackwise primary `#00D95F` (not Replicate orange `#ea2804`, not legacy `#69b32b`). Display = Bricolage Grotesque; body = Geist; mono = JetBrains Mono. Follow DESIGN.MD together with `src/theme/` and `src/components/ui/`. Do not reintroduce Sentry slate, PostHog yellow branding, or proprietary Freigeist/Basier fonts without a license.
- When documentation and implementation disagree, identify the discrepancy and update affected documentation within the task; do not silently change product behavior to match stale prose.
  Architecture and code placement
- Use Expo, React Native, TypeScript, and Expo Router within the existing architecture. Preserve supported platform behavior when changing shared code.
- app/ contains routes and navigator layouts. Keep reusable UI, data access, schemas, and business calculations in src/.
- src/features/ owns domain behavior. Reuse its hooks, APIs, schemas, and calculations rather than duplicating logic in screens.
- src/components/ui/ owns shared UI primitives. src/lib/ owns shared infrastructure, including the Supabase client, query client, error reporting, and analytics adapters.
- Use TanStack Query for remote/server state. Include user identity and relevant filters in user-specific query keys, gate queries appropriately, and invalidate affected data after mutations.
- Use local React state for component state and the existing Zustand store for active workout drafts. Do not duplicate server data into global stores without a concrete need.
- Use the existing @/ import alias. Keep types accurate and validate untrusted input at boundaries; do not hide errors with broad casts, any, or disabled checks.
- Handle loading, empty, error, retry, and success states where relevant. Do not turn failed requests into misleading zero values or empty-success screens.
- For multi-step writes, account for partial failure and retries. Do not discard a user's draft or claim success before required writes succeed. Prefer a transactional database operation when consistency requires one.
  Expo, native dependencies, and builds
- Before changing Expo, React Native, Router, or EAS integration, read the installed versions from package.json and consult the matching official documentation. Start with <https://docs.expo.dev/versions/v><major>.0.0/ for SDK APIs and <https://docs.expo.dev/llms.txt> for the relevant guides. Do not assume latest-version examples match this checkout.
- Use the package manager selected by the checked-in lockfile and repository conventions. Do not introduce a second lockfile. If selection is ambiguous, resolve it before changing dependencies.
- Use the project package runner with expo install for Expo/React Native packages so versions match the SDK. Prefer existing dependencies; justify additions. Review upgrades and expo install --fix changes before keeping them.
- Keep generated native projects generated: when ios/ and android/ are absent and the project uses Continuous Native Generation, configure native changes through app configuration and plugins. Do not create native folders by hand. If native folders become tracked intentionally, inspect their workflow before editing.
- Expo Go only supports its bundled native modules. Check whether a change requires a development build; do not promise that a QR scan in Expo Go will test unsupported native functionality.
- Read eas.json and app configuration before build work. Use the configured profiles and the appropriate EAS CLI runner. Building does not imply authorization to submit to stores, publish an OTA update, or deploy production changes.
- Preserve bundle identifiers, package names, URL schemes, and provider callback compatibility unless the task explicitly requires changing them.
- Keep shared modules safe for web/static rendering where supported; do not access window or document at module initialization without an appropriate platform/runtime guard.
  Navigation, authentication, and bootstrap
- Use Expo Router for navigation. Follow existing typed routes and layouts; do not silence routing errors with arbitrary casts or add a parallel navigation system.
- AuthProvider owns authentication/session state. BootstrapProvider and root route guards determine access and startup destination. Integrate with them rather than scattering redirect decisions across screens.
- Preserve the distinction between the welcome/onboarding flag and account setup completion. A welcome flag alone does not mean a profile is complete.
- Preserve session restoration, email verification, incomplete setup routing, completed profile routing, and password recovery. Recovery sessions must remain in the recovery flow until it completes.
- Keep email OTP length, app validation, local configuration, email templates, and hosted provider settings consistent. Read the configured values rather than hardcoding assumptions into new flows.
- Handle deep links and OAuth callbacks once across browser results, global listeners, and callback screens. Cover cancellation, errors, warm starts, and cold starts. Validate expected callback destinations and use the supported auth library flow.
- Preserve session persistence/remember-me behavior when adding sign-in methods. Clear user-specific caches and drafts appropriately on sign-out or account changes to prevent cross-account data leaks.
- Use Supabase's supported identity mechanisms. Do not merge accounts or transfer data solely because two identities report the same email address.
- Request only provider permissions needed for the feature. Provider credentials, redirect allowlists, and production verification are environment-specific; code changes alone do not prove they are configured.
  Supabase, migrations, and data protection
- Reuse the shared Supabase client and existing Auth/Postgres/RLS architecture. Do not introduce a replacement backend or auth system without a task requiring it.
- Put schema, constraints, functions, grants, and policy changes in versioned migrations. Add a new migration for changes to an already-applied schema; do not rewrite applied history to make a local database pass.
- Enable RLS for user-owned data and enforce ownership through authenticated identity, including child relationships. Client-side user filters are useful but are not a security boundary. Preserve intentionally shared catalog access.
- Validate database changes on an appropriate local/test database. Check both authorized access and denial for another user when changing ownership policies.
- Do not run destructive resets, delete volumes, remove user data, or apply migrations to a hosted production project without authorization for that operation. Inspect the target environment before running write commands.
- Use server-side functions or trusted backend execution for operations requiring elevated credentials. Never put service-role/secret keys, database passwords, OAuth client secrets, tokens, or real user data in app code, EXPO_PUBLIC_* variables, logs, fixtures, or git.
- Public/publishable client configuration is not a substitute for RLS. Keep secrets in ignored environment files or the appropriate service secret store.
  Environments, Docker, and device connectivity
- Inspect existing scripts and environment loading before changing local setup. Keep Cloud and local configurations explicit and easy to switch. Do not overwrite existing credentials or silently change a developer's backend.
- Local and hosted Supabase have separate users, data, provider configuration, and email behavior. Do not assume one is a copy of the other.
- Prefer the Supabase CLI's Docker workflow for local services. Do not add a redundant Dockerfile or Compose stack when the CLI is sufficient. Check Docker daemon availability and CLI compatibility before troubleshooting the app.
- A physical device's localhost refers to that device. LAN access requires reachable host addressing, published ports, and appropriate firewall/network settings. A phone on mobile data needs a separate route to a local backend.
- Expo tunnel forwards the Expo development server, not Supabase. Prefer a private connection when remote device access is needed. Obtain approval before exposing a local service publicly; limit access to the required API and do not expose database, Studio, or test email administration.
- Keep machine IPs, temporary URLs, network assumptions, and personal credentials out of permanent project rules. Document placeholders and reproducible setup instead.
- Verify environment changes using a restarted development server/cache refresh when required. Report the actual backend used for a test without printing credentials.
  UI, design, accessibility, and localization
- Reuse current Trackwise theme tokens, typography/font loading, spacing, radii, and shared primitives. Extend the shared system deliberately when necessary rather than introducing screen-specific replacements.
- Support light, dark, and system theme behavior where implemented. Use semantic background/surface/text tokens; primary and secondary colors are for actions and emphasis, not generic card backgrounds.
- Keep the Trackwise brand and existing assets consistent. Verify asset paths before using them; do not rely on outdated README asset names.
- Design for small screens, safe areas, keyboards, scrolling, long labels, and larger text. Provide accessible labels/roles, usable touch targets, visible focus where relevant, and sufficient contrast. Do not communicate status through color alone.
- Put new or changed user-facing copy into the existing i18n system. Update supported locale resources with matching keys and preserve interpolation/pluralization. Derive the locale list from src/i18n/ rather than maintaining a second list here.
- Use locale-aware formatting for display. Keep storage formats and unit conversions explicit; do not mix display units with database units.
- Avoid unnecessary animation and respect reduced-motion settings when adding motion.
  Nutrition, workouts, dates, and calculations
- Reuse domain calculation helpers and schemas. Keep calculations independent of UI where practical and cover meaningful edge cases with tests.
- Preserve nutrient basis and unit semantics, such as per-100-g values versus consumed portions, kilograms versus display units, and seconds versus minutes. Check conversion and rounding at boundaries.
- Preserve existing eligibility/safety gates for generated plans. Do not change calorie formulas, minimums, activity assumptions, or goal rules as an incidental refactor; explain and validate intentional changes.
- Distinguish estimates, missing data, and measured values in behavior and copy. Do not fabricate precision or health claims.
- Decide deliberately whether a field represents a local calendar day or an absolute timestamp. Avoid UTC slicing for a user's local day unless the domain explicitly requires UTC. Test day boundaries when changing diary, workout, or measurement dates.
- Validate external food/provider responses through existing adapters and handle incomplete records and network failures.
  Verification and delivery
- Use scripts actually defined in package.json. After code changes, run lint and typecheck, plus relevant tests. Use focused tests for changed behavior and broader checks when shared infrastructure or dependencies change.
- For auth/routing changes, test relevant session, recovery, setup, cancellation, and callback paths. For database changes, validate migrations and policies. For UI changes, inspect affected screens and themes on available targets.
- For documentation-only or configuration-only tasks, perform relevant checks instead of claiming a full runtime test. Ensure documented commands and file references match the checkout.
- Distinguish pre-existing failures from introduced failures using evidence. Do not disable checks or modify unrelated code merely to produce a green result. State blocked or unavailable checks clearly.
- Update affected README/setup guidance when changing commands, environment variables, architecture, or configuration. Keep temporary troubleshooting logs and task status out of permanent documentation.
- Review the final diff for secrets, generated noise, unrelated changes, and lockfile consistency. Do not commit, push, publish, deploy, or submit externally unless authorized by the task.
- Report the behavior changed, checks actually run, unresolved limitations, and any required manual setup. A successful build or HTTP response alone does not prove end-to-end mobile behavior.
  Maintaining these instructions
  Keep this file focused on durable project decisions. Do not add task-specific to-do lists, today's errors, fixed SDK versions, local machine paths, current provider setup status, or instructions that merely repeat source code. Update these rules when an intentional architecture or workflow change makes them inaccurate.
