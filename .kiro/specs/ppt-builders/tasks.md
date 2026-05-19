# Implementation Plan: PPT Builders

## Overview

Implement a mobile-first, full-stack construction site management application using Next.js 14 (App Router), Tailwind CSS, Prisma (SQLite), and NextAuth.js. The workflow covers Admin plan creation, Supervisor execution tracking, live timeline updates via SSE, media uploads, and end-of-day DPR submission. Tasks are ordered so each step builds on the previous, ending with full integration.

## Tasks

- [x] 1. Project initialization and configuration
  - Scaffold a new Next.js 14 project with the App Router (`npx create-next-app@latest`)
  - Install and configure Tailwind CSS and Lucide Icons
  - Install Prisma, NextAuth.js, bcryptjs, zod, react-hook-form, and fast-check
  - Create `.env` with `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `MEDIA_BACKEND=local`
  - Set up `tsconfig.json` path aliases (`@/` → `src/`)
  - Create the `app/` directory structure matching the design's page layout
  - _Requirements: 10.6_

- [x] 2. Database schema and migrations
  - [x] 2.1 Write the Prisma schema
    - Define all six models: `User`, `Site`, `DailyPlan`, `ResourceTrack`, `SitePhoto`, `DailyReport`
    - Define enums: `Role`, `PlanStatus`, `ResourceStatus`
    - Add `@@unique([siteId, date])` on `DailyPlan` and `@unique` on `DailyReport.planId`
    - Run `prisma migrate dev --name init` to generate the SQLite migration
    - _Requirements: 2.2, 3.10, 7.8, 11.1, 11.2, 11.3_

  - [x] 2.2 Write property test for schema uniqueness constraints (Property 9, Property 19)
    - **Property 9: One plan per site per date (uniqueness invariant)**
    - **Validates: Requirements 3.10**
    - **Property 19: One DPR per plan (uniqueness invariant)**
    - **Validates: Requirements 7.8**
    - Use fast-check to generate arbitrary `(siteId, date)` pairs and verify that a second insert is rejected
    - Tag: `// Feature: ppt-builders, Property 9` and `// Feature: ppt-builders, Property 19`

  - [x] 2.3 Seed script for development
    - Create `prisma/seed.ts` with one Admin user, one Supervisor user, and two Sites
    - Hash passwords with bcryptjs in the seed script
    - _Requirements: 1.7_

- [x] 3. Authentication system
  - [x] 3.1 Implement NextAuth.js Credentials provider
    - Create `app/api/auth/[...nextauth]/route.ts` with a Credentials provider
    - Look up user by username, compare password with `bcrypt.compare`, return user object with `id`, `role`
    - Configure `session.strategy = "jwt"` and include `role` in the JWT/session
    - _Requirements: 1.1, 1.2, 1.3, 1.7_

  - [x] 3.2 Write property test for authentication (Property 1, Property 2, Property 4)
    - **Property 1: Valid credentials always produce a role-appropriate session**
    - **Validates: Requirements 1.2**
    - **Property 2: Invalid credentials never produce a session**
    - **Validates: Requirements 1.3**
    - **Property 4: Passwords are never stored as plaintext**
    - **Validates: Requirements 1.7**
    - Use fast-check to generate arbitrary username/password strings and verify session and hash behavior
    - Tag: `// Feature: ppt-builders, Property 1`, `Property 2`, `Property 4`

  - [x] 3.3 Build the LoginForm component
    - Create `app/(auth)/login/page.tsx` with username and password fields
    - Use react-hook-form + Zod for client-side validation
    - Call `signIn('credentials', ...)` on submit; display `ErrorBanner` on failure
    - Redirect to role-specific dashboard on success
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.4 Implement role-based route protection middleware
    - Create `middleware.ts` at the project root
    - Read session role; redirect Supervisors away from `/admin/*` routes (403 or redirect)
    - Redirect Admins away from `/supervisor/*` routes
    - Redirect unauthenticated users to `/login` for all protected routes
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 3.5 Write property test for route access control (Property 3)
    - **Property 3: Role-based route access control**
    - **Validates: Requirements 1.4, 1.5**
    - Use fast-check to generate arbitrary role/route combinations and verify 403 or redirect behavior
    - Tag: `// Feature: ppt-builders, Property 3`

  - [x] 3.6 Checkpoint — Ensure authentication tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Site management
  - [x] 4.1 Implement Site API routes
    - Create `app/api/sites/route.ts`: `GET` (list all sites, Admin only) and `POST` (create site, Admin only)
    - Apply `withAuth('ADMIN')` middleware wrapper to both handlers
    - Validate request body with Zod (`name` required, non-empty; `location` required)
    - Return HTTP 422 with `{ errors }` on validation failure
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 4.2 Write property test for site name validation (Property 5)
    - **Property 5: Site name validation rejects empty and whitespace-only inputs**
    - **Validates: Requirements 2.4**
    - Use fast-check to generate empty strings and whitespace-only strings; verify rejection
    - Tag: `// Feature: ppt-builders, Property 5`

  - [x] 4.3 Build the SiteForm and SiteList components
    - Create `app/(admin)/sites/new/page.tsx` with `SiteForm` (name + location fields, Zod validation, `ValidationMessage`)
    - Create `app/(admin)/sites/page.tsx` with `SiteList` (fetches `GET /api/sites`, renders site cards with links)
    - _Requirements: 2.1, 2.3, 2.4, 10.1, 10.2_

- [x] 5. DailyPlan creation (Admin)
  - [x] 5.1 Implement the Plan API routes
    - Create `app/api/plans/route.ts`: `GET` (list plans) and `POST` (create plan, Admin only)
    - Validate with Zod: `siteId`, `date`, `goals` (array of non-empty strings, min 1), `resources` (array, min 1)
    - Set `status = PENDING` and `statusChangedAt = new Date()` on the server
    - Return HTTP 409 on `@@unique` constraint violation (duplicate site+date)
    - Create `app/api/plans/[id]/route.ts`: `GET` (single plan, Admin or Supervisor)
    - _Requirements: 3.1, 3.6, 3.7, 3.9, 3.10, 11.5_

  - [x] 5.2 Write property tests for plan creation (Property 7, Property 8, Property 9)
    - **Property 7: Valid plan submissions are saved with correct initial state**
    - **Validates: Requirements 3.6**
    - **Property 8: Plan creation rejects missing required fields**
    - **Validates: Requirements 3.7**
    - **Property 9: One plan per site per date (uniqueness invariant)** (API-level test)
    - **Validates: Requirements 3.10**
    - Use fast-check to generate valid and invalid plan payloads; verify status, goals, and conflict behavior
    - Tag: `// Feature: ppt-builders, Property 7`, `Property 8`, `Property 9`

  - [x] 5.3 Build the VoiceRecorder shared component
    - Create `components/VoiceRecorder.tsx`
    - Check `navigator.mediaDevices?.getUserMedia` and `window.MediaRecorder` on mount
    - If unavailable, render `ErrorBanner` warning and hide record button (form remains submittable)
    - Implement hold-to-record and tap-to-record modes using `MediaRecorder` start/stop
    - On stop, produce a Blob URL and render `AudioPlayer` preview
    - Expose `onRecordingComplete(blob: Blob)` callback prop
    - _Requirements: 3.4, 3.5, 3.8, 7.3, 10.4, 10.5_

  - [x] 5.4 Build the GoalEditor and ResourceLineupBuilder components
    - Create `components/GoalEditor.tsx`: dynamic list of text inputs; add/remove goal items
    - Create `components/ResourceLineupBuilder.tsx`: dynamic list of resource name inputs; add/remove entries
    - Both components use react-hook-form field arrays
    - _Requirements: 3.2, 3.3, 10.1_

  - [x] 5.5 Build the PlanForm page
    - Create `app/(admin)/plans/new/page.tsx` with `PlanForm`
    - Compose `GoalEditor`, `ResourceLineupBuilder`, and `VoiceRecorder`
    - On submit: upload voice note via `POST /api/media/upload`, then `POST /api/plans` with returned URL
    - Display `LoadingSpinner` during submission; display `ErrorBanner` on failure
    - Show field-level `ValidationMessage` for missing site or date
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.9, 10.1, 10.5_

  - [x] 5.6 Write property test for plan visibility to Supervisor (Property 10)
    - **Property 10: Saved plans are immediately visible to the assigned Supervisor**
    - **Validates: Requirements 3.9**
    - Use fast-check to generate plan data; verify that a Supervisor query for the same site+date returns the plan
    - Tag: `// Feature: ppt-builders, Property 10`

  - [x] 5.7 Checkpoint — Ensure plan creation tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Media Service
  - [x] 6.1 Implement the MediaService interface and LocalMediaService
    - Create `lib/media/types.ts` with the `MediaService` interface (`upload`, `delete`)
    - Create `lib/media/local.ts` (`LocalMediaService`): write files to `public/uploads/{year}/{month}/` with `{cuid}-{slug}.{ext}` naming; return relative URL
    - Create `lib/media/s3.ts` (`S3MediaService`): stub that throws `NotImplementedError` (wired but not active)
    - Create `lib/media/cloudinary.ts` (`CloudinaryMediaService`): stub that throws `NotImplementedError`
    - Create `lib/media/index.ts`: factory that reads `MEDIA_BACKEND` env var and returns the correct implementation
    - _Requirements: 9.1, 9.2_

  - [x] 6.2 Implement the media upload API route
    - Create `app/api/media/upload/route.ts`: accept multipart form data, validate MIME type and file size
    - Accept images: `image/jpeg`, `image/png`, `image/webp` (max 10 MB)
    - Accept audio: `audio/webm`, `audio/mp4`, `audio/ogg` (max 50 MB)
    - Call `mediaService.upload(...)` and return `{ url }` on success
    - If storage throws, return HTTP 500 and do not create any DB record
    - _Requirements: 6.4, 6.5, 6.6, 9.1, 9.3, 9.4_

  - [x] 6.3 Write property tests for Media Service (Property 22, Property 23)
    - **Property 22: Media Service returns a stable URL for every upload**
    - **Validates: Requirements 9.2**
    - **Property 23: Storage failure prevents database record creation**
    - **Validates: Requirements 9.4**
    - Use fast-check to generate file buffers and filenames; verify URL stability and failure isolation
    - Tag: `// Feature: ppt-builders, Property 22`, `Property 23`

  - [x] 6.4 Write property test for photo format and size validation (Property 15)
    - **Property 15: Photo file format and size validation**
    - **Validates: Requirements 6.4, 6.5, 6.6**
    - Use fast-check to generate MIME types and file sizes; verify accept/reject boundary behavior
    - Tag: `// Feature: ppt-builders, Property 15`

  - [x] 6.5 Implement media access control middleware
    - Extend Next.js middleware to check session before serving `/public/uploads/*` files
    - Return HTTP 401 for unauthenticated requests; HTTP 403 for users without site access
    - _Requirements: 9.5_

  - [x] 6.6 Write property test for media access control (Property 24)
    - **Property 24: Media access control enforces site membership**
    - **Validates: Requirements 9.5**
    - Use fast-check to generate user/site combinations; verify 401/403 for unauthorized access
    - Tag: `// Feature: ppt-builders, Property 24`

- [x] 7. Supervisor Execution View
  - [x] 7.1 Build the MorningBriefingCard component
    - Create `components/MorningBriefingCard.tsx`: display plan goals as a bulleted list
    - Render `AudioPlayer` if `voiceNoteUrl` is present
    - Display "No plan for today" message if no plan exists
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x] 7.2 Implement the resource arrival API route
    - Create `app/api/resources/[id]/arrive/route.ts`: `POST`, Supervisor only
    - Set `status = ARRIVED` and `arrivedAt = new Date()` (server-side) on the `ResourceTrack`
    - Return HTTP 409 if resource is already `ARRIVED`
    - _Requirements: 5.2, 5.5, 11.1_

  - [x] 7.3 Write property tests for resource arrival (Property 12, Property 13)
    - **Property 12: Resource status display invariant**
    - **Validates: Requirements 5.1, 5.3**
    - **Property 13: Resource arrival sets server-side timestamp and prevents re-arrival**
    - **Validates: Requirements 5.2, 5.5**
    - Use fast-check to generate resource states; verify button visibility, timestamp presence, and idempotency rejection
    - Tag: `// Feature: ppt-builders, Property 12`, `Property 13`

  - [x] 7.4 Build the ResourceChecklist component
    - Create `components/ResourceChecklist.tsx`: card-based list of resources
    - Show "Mark Arrived" button for `PENDING` resources; hide it and show `arrivedAt` for `ARRIVED` resources
    - Call `POST /api/resources/[id]/arrive` on tap; show `LoadingSpinner` during request
    - _Requirements: 5.1, 5.2, 5.3, 10.1, 10.3, 10.5_

  - [x] 7.5 Build the PhotoUploader component
    - Create `components/PhotoUploader.tsx`: drag-and-drop and tap-to-select upload area
    - Validate MIME type and file size client-side before upload; show `ErrorBanner` on rejection
    - Call `POST /api/media/upload` then `POST /api/photos`; show `LoadingSpinner` during upload
    - Display previously uploaded photos in reverse chronological order as thumbnails
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 9.3, 10.1, 10.3_

  - [x] 7.6 Implement the photo upload API route
    - Create `app/api/photos/route.ts`: `POST`, Supervisor only
    - Call `mediaService.upload(...)`, then create `SitePhoto` with `uploadedAt = new Date()` (server-side)
    - Return HTTP 500 and skip DB write if storage fails
    - _Requirements: 6.2, 6.3, 11.2_

  - [x] 7.7 Write property tests for photo upload (Property 14, Property 16)
    - **Property 14: Photo upload creates a record with server-side timestamp and stable URL**
    - **Validates: Requirements 6.2, 11.2**
    - **Property 16: Uploaded photos are displayed in reverse chronological order**
    - **Validates: Requirements 6.7**
    - Use fast-check to generate photo sets with distinct timestamps; verify record fields and ordering
    - Tag: `// Feature: ppt-builders, Property 14`, `Property 16`

  - [x] 7.8 Assemble the ExecutionView page
    - Create `app/(supervisor)/execution/page.tsx`
    - Fetch today's plan for the Supervisor's assigned site; compose `MorningBriefingCard`, `ResourceChecklist`, and `PhotoUploader`
    - Use a vertically scrollable, card-based layout
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.2, 10.3_

  - [x] 7.9 Write property test for execution view plan display (Property 11)
    - **Property 11: Execution view displays all goals and resources from the plan**
    - **Validates: Requirements 4.2, 4.3**
    - Use fast-check to generate plans with N goals and M resources; verify all are present in the response
    - Tag: `// Feature: ppt-builders, Property 11`

  - [x] 7.10 Checkpoint — Ensure Supervisor execution tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [-] 8. DPR Form (Supervisor)
  - [x] 8.1 Implement the DPR API route
    - Create `app/api/dpr/route.ts`: `POST`, Supervisor only
    - Validate with Zod: `masons` and `helpers` as non-negative integers; `length`, `breadth`, `height` as positive numbers
    - Create `DailyReport` with `submittedAt = new Date()` (server-side); update `DailyPlan.status = COMPLETED` and `statusChangedAt = new Date()`
    - Return HTTP 409 if a report already exists for the plan
    - Return HTTP 422 with field errors for invalid numeric values
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6, 7.8, 11.3, 11.5_

  - [x] 8.2 Write property tests for DPR submission (Property 17, Property 18, Property 19)
    - **Property 17: DPR numeric field validation**
    - **Validates: Requirements 7.1, 7.2, 7.6**
    - **Property 18: DPR submission links report to plan and marks plan completed**
    - **Validates: Requirements 7.4, 7.5, 11.5**
    - **Property 19: One DPR per plan (uniqueness invariant)** (API-level test)
    - **Validates: Requirements 7.8**
    - Use fast-check to generate numeric field values (including negatives and non-numerics) and duplicate submissions
    - Tag: `// Feature: ppt-builders, Property 17`, `Property 18`, `Property 19`

  - [x] 8.3 Build the DPRForm component and page
    - Create `app/(supervisor)/dpr/page.tsx` with `DPRForm`
    - Fields: Masons (integer), Helpers (integer), Length (float), Breadth (float), Height (float)
    - Compose `VoiceRecorder` for voice remark (optional)
    - On submit: upload voice remark if recorded, then `POST /api/dpr`
    - Show `ValidationMessage` for invalid fields; show `ErrorBanner` on server errors
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 10.1, 10.5_

- [x] 9. Admin Live Timeline dashboard
  - [x] 9.1 Implement the timeline query API route
    - Create `app/api/timeline/route.ts`: `GET`, Admin only
    - Query `ResourceTrack` (ARRIVED), `SitePhoto`, and `DailyReport` records for today across all Admin-accessible sites
    - Return events sorted by timestamp descending; support `?siteId=` filter query param
    - Shape each event as `TimelineEvent` (id, type, siteId, siteName, timestamp, payload)
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 9.2 Implement the SSE streaming endpoint
    - Create `app/api/timeline/stream/route.ts`: `GET`, Admin only
    - Set `Content-Type: text/event-stream` headers; keep connection alive
    - Poll the database every 3 seconds for events newer than the last sent event ID
    - Send heartbeat comment (`: ping`) every 30 seconds
    - Push new events as JSON-encoded SSE messages with `id:` field set to the event's DB id
    - _Requirements: 8.4, 5.4, 6.3, 7.9_

  - [x] 9.3 Build the TimelineEvent card component
    - Create `components/TimelineEvent.tsx`: timestamp badge, event type icon (Lucide), site name
    - For `PHOTO_UPLOADED` events: render thumbnail `<img>` with click handler to open full-size image
    - _Requirements: 8.3, 8.5, 8.7_

  - [x] 9.4 Build the LiveTimeline component with SSE client
    - Create `components/LiveTimeline.tsx`
    - Open `EventSource('/api/timeline/stream')` on mount; prepend new events to state
    - Fall back to polling `GET /api/timeline` every 5 seconds if `EventSource` is unavailable
    - Show "Reconnecting…" indicator if SSE connection drops for > 30 seconds
    - Include site filter `<select>` that filters displayed events client-side
    - _Requirements: 8.1, 8.4, 8.6_

  - [x] 9.5 Write property tests for timeline ordering and filtering (Property 20, Property 21)
    - **Property 20: Timeline events are displayed in reverse chronological order with required fields**
    - **Validates: Requirements 8.1, 8.3, 8.5**
    - **Property 21: Timeline site filter shows only matching events**
    - **Validates: Requirements 8.6**
    - Use fast-check to generate event sets with distinct timestamps and mixed siteIds; verify ordering and filter correctness
    - Tag: `// Feature: ppt-builders, Property 20`, `Property 21`

  - [x] 9.6 Assemble the AdminDashboard page
    - Create `app/(admin)/dashboard/page.tsx`
    - Render `SiteList` and `LiveTimeline` side by side on desktop (CSS grid), stacked on mobile
    - _Requirements: 2.3, 8.1, 10.2_

  - [x] 9.7 Checkpoint — Ensure timeline and dashboard tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Shared UI components and mobile-first polish
  - [x] 10.1 Implement shared utility components
    - Create `components/AudioPlayer.tsx`: HTML `<audio>` element with Tailwind-styled controls
    - Create `components/LoadingSpinner.tsx`: inline spinner for upload and submit states
    - Create `components/ErrorBanner.tsx`: dismissible error message with Lucide `AlertCircle` icon
    - Create `components/ValidationMessage.tsx`: field-level inline validation text
    - _Requirements: 10.5, 10.6_

  - [x] 10.2 Apply mobile-first layout and tap target sizing
    - Audit all primary interactive controls (buttons, inputs, upload areas) for minimum 44×44 CSS pixel tap targets
    - Ensure responsive layout works from 320px to 1440px without horizontal scrolling
    - Apply Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) throughout all pages
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 10.3 Implement Admin and Supervisor layout shells
    - Create `app/(admin)/layout.tsx`: navigation bar with site links and logout button
    - Create `app/(supervisor)/layout.tsx`: navigation bar with execution and DPR links and logout button
    - Wire logout to `signOut()` from NextAuth; redirect to `/login`
    - _Requirements: 1.6, 10.2_

- [ ] 11. Data integrity and audit trail verification
  - [x] 11.1 Write property tests for server-side timestamps (Property 13, Property 14, Property 18)
    - These properties are already covered in tasks 7.3, 7.7, and 8.2 respectively
    - Verify that no client-provided timestamp value is accepted by any API route
    - Tag: `// Feature: ppt-builders, Property 13`, `Property 14`, `Property 18`

  - [x] 11.2 Write property test for child record site association (Property 6)
    - **Property 6: All child records are associated with a valid Site**
    - **Validates: Requirements 2.2**
    - Use fast-check to generate arbitrary record creation requests; verify `siteId` referential integrity
    - Tag: `// Feature: ppt-builders, Property 6`

  - [x] 11.3 Write property test for data retention (Property 25)
    - **Property 25: Data retention — no user-facing deletion**
    - **Validates: Requirements 11.4**
    - Use fast-check to enumerate all user-facing API routes; verify none result in record deletion
    - Tag: `// Feature: ppt-builders, Property 25`

- [-] 12. Integration tests for end-to-end flows
  - [x] 12.1 Write integration test: full Admin plan creation flow
    - Seed DB → Admin login → create site → create plan with goals, resources, voice note → verify plan saved with `PENDING` status
    - Use Supertest with a real SQLite test database
    - _Requirements: 3.1–3.9_

  - [x] 12.2 Write integration test: full Supervisor execution flow
    - Seed DB with plan → Supervisor login → view execution page → mark all resources arrived → upload photo → verify timeline events
    - _Requirements: 4.1–4.4, 5.1–5.5, 6.1–6.7_

  - [x] 12.3 Write integration test: DPR submission and plan completion
    - Seed DB with plan → Supervisor submits DPR → verify `DailyReport` created, plan status `COMPLETED`, `statusChangedAt` set
    - _Requirements: 7.4, 7.5, 7.8, 11.5_

  - [x] 12.4 Write integration test: duplicate plan and DPR rejection
    - Attempt to create a second plan for the same site+date → verify HTTP 409
    - Attempt to submit a second DPR for the same plan → verify HTTP 409
    - _Requirements: 3.10, 7.8_

  - [x] 12.5 Write integration test: media upload format and size validation
    - Upload valid JPEG, PNG, WebP files → verify success
    - Upload unsupported format and oversized file → verify rejection and no DB record
    - _Requirements: 6.4, 6.5, 6.6_

  - [x] 12.6 Write integration test: Live Timeline SSE event delivery
    - Open SSE connection as Admin → Supervisor marks resource arrived → verify event received within 5 seconds
    - _Requirements: 5.4, 8.4_

  - [-] 12.7 Final checkpoint — Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- All 25 correctness properties from the design document are covered by property-based tests using fast-check (minimum 100 iterations each)
- Each property test must be tagged with `// Feature: ppt-builders, Property N: <property text>`
- Server-side timestamps (`arrivedAt`, `uploadedAt`, `submittedAt`, `statusChangedAt`) must never be accepted from client payloads — enforced in all API routes
- The `MEDIA_BACKEND` environment variable controls storage: `local` (dev), `s3`, or `cloudinary` (prod)
- Integration tests use a separate SQLite database seeded before each test run; media uploads use an in-memory `LocalMediaService` mock
