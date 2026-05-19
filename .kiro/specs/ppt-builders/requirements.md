# Requirements Document

## Introduction

PPT Builders is a mobile-first, highly interactive web application for real-time civil construction site management. The application gives the Admin complete, timeline-based visibility of site execution without requiring physical presence. It supports a two-role workflow — Admin and Supervisor — covering next-day planning, real-time resource tracking, media uploads, voice notes, and end-of-day Daily Progress Reports (DPR).

The system is built on Next.js (React) with Tailwind CSS, Prisma ORM (SQLite for development, PostgreSQL-ready for production), local/cloud media storage, and the HTML5 MediaRecorder API for in-browser voice capture.

---

## Glossary

- **Admin**: The construction project manager who creates plans, monitors live progress, and reviews DPRs without being on-site.
- **Supervisor**: The on-site worker who executes the Admin's plan, logs resource arrivals, uploads photos, and submits the DPR.
- **DPR (Daily Progress Report)**: The end-of-day report submitted by the Supervisor capturing manpower, dimensions, and voice remarks.
- **DailyPlan**: A structured plan created by the Admin for a specific site and date, containing goals, resource lineup, and voice instructions.
- **ResourceTrack**: A record of a specific resource (e.g., JCB, Water Tanker) assigned to a DailyPlan, with arrival status and timestamp.
- **SitePhoto**: A timestamped photo uploaded by the Supervisor during execution.
- **Site**: A named civil construction location managed within the system.
- **Voice_Note**: An audio recording captured via the HTML5 MediaRecorder API and stored as a URL-referenced file.
- **Live_Timeline**: The Admin's real-time feed of site events ordered chronologically.
- **System**: The PPT Builders web application as a whole.
- **Auth_Module**: The authentication subsystem responsible for login, session management, and role enforcement.
- **Plan_Form**: The Admin UI for creating and submitting a DailyPlan.
- **Execution_View**: The Supervisor UI for the morning briefing and real-time check-ins.
- **DPR_Form**: The Supervisor UI for submitting the end-of-day Daily Progress Report.
- **Media_Service**: The subsystem responsible for storing and retrieving image and audio files.
- **Recorder**: The in-browser audio recording component powered by the HTML5 MediaRecorder API.

---

## Requirements

### Requirement 1: User Authentication and Role-Based Access

**User Story:** As a user (Admin or Supervisor), I want to log in with my credentials, so that I can access only the features relevant to my role.

#### Acceptance Criteria

1. THE Auth_Module SHALL provide a login form accepting a username and password.
2. WHEN a user submits valid credentials, THE Auth_Module SHALL create an authenticated session and redirect the user to their role-specific dashboard.
3. IF a user submits invalid credentials, THEN THE Auth_Module SHALL display an error message and SHALL NOT create a session.
4. WHILE a user session is active, THE System SHALL restrict access to routes based on the user's assigned role (Admin or Supervisor).
5. WHEN an unauthenticated user attempts to access a protected route, THE Auth_Module SHALL redirect the user to the login page.
6. WHEN a user logs out, THE Auth_Module SHALL invalidate the session and redirect the user to the login page.
7. THE System SHALL store passwords as cryptographic hashes and SHALL NOT store plaintext passwords.

---

### Requirement 2: Site Management

**User Story:** As an Admin, I want to create and manage construction sites, so that plans and reports can be organized by location.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to create a Site with a name and location.
2. THE System SHALL associate every DailyPlan, ResourceTrack, SitePhoto, and DailyReport with exactly one Site.
3. WHEN an Admin views the dashboard, THE System SHALL display a list of all Sites the Admin manages.
4. IF a Site name is left empty during creation, THEN THE System SHALL display a validation error and SHALL NOT save the Site.

---

### Requirement 3: Next-Day Planning and Goal Setting (Admin)

**User Story:** As an Admin, I want to create a detailed next-day plan for a specific site, so that the Supervisor has clear goals, resources, and audio instructions before execution begins.

#### Acceptance Criteria

1. THE Plan_Form SHALL allow an Admin to select a target Site and a target date for the plan.
2. THE Plan_Form SHALL allow an Admin to enter one or more text goals (e.g., "4 layers of guardwall", "30 m3 concrete pouring").
3. THE Plan_Form SHALL allow an Admin to add one or more resources to the resource lineup by selecting a resource name (e.g., JCB, Water Tanker, Cement, Sand).
4. THE Recorder SHALL allow an Admin to record a voice instruction by holding or tapping a record button, using the HTML5 MediaRecorder API.
5. WHEN an Admin stops recording, THE Recorder SHALL produce an audio preview so the Admin can review the recording before saving.
6. WHEN an Admin submits the Plan_Form with all required fields completed, THE System SHALL save the DailyPlan with a status of "Pending Execution" and persist the voice note via the Media_Service.
7. IF an Admin submits the Plan_Form without selecting a Site or date, THEN THE System SHALL display a field-level validation error and SHALL NOT save the DailyPlan.
8. IF the MediaRecorder API is unavailable in the user's browser, THEN THE System SHALL display a warning message indicating that voice recording is not supported and SHALL allow plan submission without a voice note.
9. WHEN a DailyPlan is saved, THE System SHALL make it immediately visible to the assigned Supervisor on their Execution_View for the corresponding date.
10. THE System SHALL prevent an Admin from creating more than one DailyPlan for the same Site on the same date.

---

### Requirement 4: Morning Briefing — Supervisor Execution View

**User Story:** As a Supervisor, I want to see today's goals, resource lineup, and Admin voice instructions when I log in, so that I can begin execution with full context.

#### Acceptance Criteria

1. WHEN a Supervisor logs in, THE Execution_View SHALL display the DailyPlan for the current date and the Supervisor's assigned Site.
2. THE Execution_View SHALL display the text goals defined by the Admin for the current DailyPlan.
3. THE Execution_View SHALL display the full resource lineup with each resource's current status (Pending or Arrived).
4. WHERE a voice instruction is attached to the DailyPlan, THE Execution_View SHALL display an audio player allowing the Supervisor to play the Admin's voice note.
5. IF no DailyPlan exists for the current date and site, THEN THE Execution_View SHALL display a message indicating that no plan has been created for today.

---

### Requirement 5: Real-Time Resource Arrival Tracking

**User Story:** As a Supervisor, I want to mark resources as arrived with a single tap, so that the Admin can see live resource status with exact timestamps.

#### Acceptance Criteria

1. THE Execution_View SHALL display a "Mark Arrived" button for each resource in the lineup that has a status of "Pending".
2. WHEN a Supervisor taps "Mark Arrived" for a resource, THE System SHALL record the exact server-side timestamp and update the ResourceTrack status to "Arrived".
3. WHEN a resource status is updated to "Arrived", THE System SHALL remove the "Mark Arrived" button for that resource and display the recorded arrival timestamp.
4. WHEN a resource is marked as arrived, THE Live_Timeline SHALL display a new event entry within 5 seconds, formatted as "[HH:MM AM/PM] - [Resource Name] Arrived at [Site Name]".
5. THE System SHALL prevent a Supervisor from marking the same resource as arrived more than once for the same DailyPlan.

---

### Requirement 6: Live Photo Uploads During Execution

**User Story:** As a Supervisor, I want to upload progress photos throughout the day, so that the Admin has visual evidence of site progress with timestamps.

#### Acceptance Criteria

1. THE Execution_View SHALL provide a photo upload control allowing the Supervisor to select and upload one or more images.
2. WHEN a Supervisor uploads a photo, THE Media_Service SHALL store the image file and THE System SHALL create a SitePhoto record with the server-side upload timestamp and a reference URL.
3. WHEN a photo is uploaded, THE Live_Timeline SHALL display a new event entry within 5 seconds, formatted as "[HH:MM AM/PM] - Photo Uploaded at [Site Name]", with a thumbnail preview.
4. THE System SHALL accept image files in JPEG, PNG, and WebP formats.
5. IF a Supervisor attempts to upload a file that is not a supported image format, THEN THE System SHALL display an error message and SHALL NOT store the file.
6. IF a Supervisor attempts to upload an image file exceeding 10 MB, THEN THE System SHALL display an error message and SHALL NOT store the file.
7. THE Execution_View SHALL display all previously uploaded photos for the current DailyPlan in reverse chronological order.

---

### Requirement 7: End-of-Day Daily Progress Report (DPR) Submission

**User Story:** As a Supervisor, I want to submit an end-of-day report with manpower counts, work dimensions, and a voice remark, so that the Admin has a complete record of what was accomplished.

#### Acceptance Criteria

1. THE DPR_Form SHALL allow a Supervisor to enter manpower counts for Masons and Helpers as non-negative integers.
2. THE DPR_Form SHALL allow a Supervisor to enter the dimensions of work completed as numeric values for Length, Breadth, and Height.
3. THE Recorder SHALL allow a Supervisor to record a voice remark using the HTML5 MediaRecorder API, following the same hold-or-tap interaction pattern as the Admin voice note.
4. WHEN a Supervisor submits the DPR_Form, THE System SHALL save the DailyReport linked to the current DailyPlan and persist any voice remark via the Media_Service.
5. WHEN a DailyReport is submitted, THE System SHALL update the DailyPlan status to "Completed".
6. IF a Supervisor submits the DPR_Form with a non-numeric value in any dimension field, THEN THE System SHALL display a validation error and SHALL NOT save the DailyReport.
7. THE System SHALL allow a DPR to be submitted without a voice remark.
8. THE System SHALL prevent a Supervisor from submitting more than one DailyReport for the same DailyPlan.
9. WHEN a DailyReport is submitted, THE Live_Timeline SHALL display a new event entry indicating DPR submission for the site.

---

### Requirement 8: Admin Live Timeline Dashboard

**User Story:** As an Admin, I want a real-time timeline feed of all site events, so that I can monitor execution progress across all sites without being physically present.

#### Acceptance Criteria

1. THE Live_Timeline SHALL display all events for the current day across all sites managed by the Admin, ordered chronologically with the most recent event at the top.
2. THE Live_Timeline SHALL include the following event types: resource arrivals, photo uploads, and DPR submissions.
3. WHEN the Admin views the Live_Timeline, THE System SHALL display each event with its timestamp, event type, and associated site name.
4. THE Live_Timeline SHALL refresh automatically to show new events without requiring a full page reload.
5. WHERE a photo upload event is displayed, THE Live_Timeline SHALL show a thumbnail of the uploaded image.
6. THE System SHALL allow an Admin to filter the Live_Timeline by Site.
7. WHEN an Admin selects a photo thumbnail in the Live_Timeline, THE System SHALL display the full-size image.

---

### Requirement 9: Media Storage and Retrieval

**User Story:** As a system operator, I want all uploaded media files to be stored reliably and served securely, so that voice notes and photos are always accessible to authorized users.

#### Acceptance Criteria

1. THE Media_Service SHALL store uploaded audio files (voice notes and voice remarks) and image files (site photos) using a configurable storage backend (local filesystem for development, AWS S3 or Cloudinary for production).
2. THE Media_Service SHALL return a stable URL for each stored file that can be embedded in audio players and image elements.
3. WHILE a file upload is in progress, THE System SHALL display a loading indicator to the user.
4. IF a file upload fails due to a storage error, THEN THE System SHALL display an error message and SHALL NOT create the associated database record.
5. THE System SHALL serve media files only to authenticated users with access to the associated Site.

---

### Requirement 10: Mobile-First UI and Accessibility

**User Story:** As a Supervisor working on-site, I want a UI with large tap targets and intuitive controls, so that I can operate the app efficiently on a mobile device in field conditions.

#### Acceptance Criteria

1. THE System SHALL render all primary interactive controls (buttons, inputs, upload areas) with a minimum tap target size of 44×44 CSS pixels on mobile viewports.
2. THE System SHALL use a responsive layout that adapts to screen widths from 320px to 1440px without horizontal scrolling.
3. THE Execution_View SHALL present the resource checklist and photo upload controls in a vertically scrollable, card-based layout resembling a messaging timeline.
4. THE Recorder SHALL display a clearly labeled record button that responds to both hold-to-record and tap-to-record interactions.
5. THE System SHALL provide visual feedback (color change, animation, or icon update) within 100ms of any user interaction with a primary control.
6. THE System SHALL use Tailwind CSS utility classes and Lucide Icons for all UI components to maintain visual consistency.

---

### Requirement 11: Data Integrity and Audit Trail

**User Story:** As an Admin, I want all site events to be permanently recorded with accurate timestamps, so that I have a reliable audit trail for project accountability.

#### Acceptance Criteria

1. THE System SHALL record all ResourceTrack arrival timestamps using the server-side clock to prevent client-side manipulation.
2. THE System SHALL record all SitePhoto upload timestamps using the server-side clock.
3. THE System SHALL record the DailyReport submission timestamp using the server-side clock.
4. THE System SHALL retain all DailyPlan, ResourceTrack, SitePhoto, and DailyReport records and SHALL NOT delete them through any user-facing action.
5. WHEN a DailyPlan status changes, THE System SHALL record the new status and the time of the change.

---

### Requirement 12: Supervisor DPR Voice Remark Visibility to Admin

**User Story:** As an Admin, I want to see the Supervisor's DPR voice remark alongside the plan summary in the dashboard, so that I can hear the Supervisor's end-of-day feedback without navigating to a separate report view.

#### Acceptance Criteria

1. WHEN a DailyReport with a `voiceRemarkUrl` exists for a DailyPlan, THE System SHALL display an audio player for the Supervisor's voice remark in the Admin's plan summary view (e.g., the MorningBriefingCard or plans list).
2. THE System SHALL label the Supervisor's voice remark audio player distinctly from the Admin's voice instruction audio player so that the Admin can identify which recording belongs to which role.
3. IF a DailyReport has no voice remark, THEN THE System SHALL NOT display a voice remark audio player for that plan.
4. THE System SHALL make the Supervisor's voice remark accessible to the Admin as soon as the DailyReport is submitted, without requiring a page reload.

---

### Requirement 13: Camera with Geolocation for Photo Uploads

**User Story:** As a Supervisor on-site, I want the photo upload control to open the rear camera directly and embed GPS coordinates in the photo metadata, so that each photo is automatically tagged with its capture location.

#### Acceptance Criteria

1. THE Execution_View SHALL render the photo file input with `capture="environment"` so that mobile browsers open the rear-facing camera directly when the upload control is tapped.
2. WHEN a Supervisor initiates a photo upload, THE System SHALL request the device's current GPS coordinates using the browser Geolocation API before the upload is submitted.
3. WHEN GPS coordinates are successfully obtained, THE System SHALL include the latitude and longitude values in the photo upload request payload.
4. THE System SHALL store the latitude and longitude values alongside the SitePhoto record in the database.
5. IF the Geolocation API is unavailable or the Supervisor denies location permission, THEN THE System SHALL proceed with the photo upload without coordinates and SHALL NOT block the upload.
6. WHEN a SitePhoto record includes GPS coordinates, THE System SHALL display the latitude and longitude alongside the photo thumbnail in the Execution_View and Live_Timeline.

---

### Requirement 14: Default Resource Presets in Resource Lineup Builder

**User Story:** As an Admin creating a plan, I want to tap preset resource chips (e.g., JCB, Water Tanker, Cement, Sand, Mason, Helper) to quickly add common resources to the lineup, so that I do not have to type each resource name manually.

#### Acceptance Criteria

1. THE Plan_Form SHALL display a set of preset resource chips above the resource lineup input list, including at minimum: JCB, Water Tanker, Cement, Sand, Mason, Helper.
2. WHEN an Admin taps a preset chip, THE System SHALL add a new resource entry to the lineup with the chip's label pre-filled as the resource name.
3. THE System SHALL allow an Admin to tap the same preset chip multiple times to add multiple entries of the same resource type.
4. THE System SHALL allow an Admin to edit the pre-filled resource name in any entry added via a preset chip.
5. THE System SHALL allow an Admin to add resources by typing manually in addition to using preset chips, preserving the existing free-text input behavior.
6. THE System SHALL render preset chips with a minimum tap target size of 44×44 CSS pixels on mobile viewports.

---

### Requirement 15: Site Edit and Delete

**User Story:** As an Admin, I want to edit a site's name and location and delete a site when it is no longer needed, so that the site list stays accurate and uncluttered.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to update a Site's name and location through an edit form.
2. WHEN an Admin submits a valid site edit, THE System SHALL persist the updated name and location and display the updated values immediately.
3. IF an Admin submits a site edit with an empty name, THEN THE System SHALL display a validation error and SHALL NOT save the change.
4. THE System SHALL allow an Admin to initiate deletion of a Site.
5. WHEN an Admin initiates deletion of a Site that has one or more associated DailyPlans, THE System SHALL display a warning message listing the number of associated plans and SHALL require explicit confirmation before proceeding.
6. WHEN an Admin confirms deletion of a Site with no associated DailyPlans, THE System SHALL delete the Site record and remove it from the site list.
7. WHEN an Admin confirms deletion of a Site that has associated DailyPlans, THE System SHALL delete the Site record and all associated DailyPlan, ResourceTrack, SitePhoto, and DailyReport records in a single atomic operation.
8. IF a Site deletion fails due to a database error, THEN THE System SHALL display an error message and SHALL NOT partially delete any records.

---

### Requirement 16: Plan Edit and Delete

**User Story:** As an Admin, I want to edit a plan's goals, resources, and voice note and delete a plan when it was created in error, so that I can correct mistakes before execution begins.

#### Acceptance Criteria

1. THE System SHALL allow an Admin to edit the goals, resource lineup, and voice note of a DailyPlan whose status is "PENDING".
2. WHEN an Admin submits a valid plan edit, THE System SHALL persist the updated goals, resources, and voice note URL and display the updated values immediately.
3. IF an Admin attempts to edit a DailyPlan whose status is "COMPLETED", THEN THE System SHALL display an error message and SHALL NOT allow the edit.
4. THE System SHALL allow an Admin to delete a DailyPlan.
5. WHEN an Admin initiates deletion of a DailyPlan whose status is "COMPLETED" or that has an associated DailyReport, THE System SHALL display a warning and SHALL NOT allow deletion.
6. WHEN an Admin initiates deletion of a DailyPlan whose status is "PENDING" and that has no associated DailyReport, THE System SHALL require explicit confirmation before proceeding.
7. WHEN an Admin confirms deletion of a PENDING DailyPlan with no DailyReport, THE System SHALL delete the DailyPlan and all associated ResourceTrack and SitePhoto records in a single atomic operation.
8. IF a plan deletion fails due to a database error, THEN THE System SHALL display an error message and SHALL NOT partially delete any records.

---

### Requirement 17: Push Notifications

**User Story:** As a Supervisor or Admin, I want to receive push notifications for key workflow events, so that I am alerted immediately without having to keep the app open.

#### Acceptance Criteria

1. THE System SHALL implement Web Push API integration using VAPID keys to deliver push notifications to subscribed browsers.
2. WHEN an authenticated user visits the application, THE System SHALL prompt the user to grant push notification permission and, upon grant, SHALL register the browser's push subscription with the server.
3. THE System SHALL store each user's push subscription endpoint, p256dh key, and auth key in the database, associated with the user's account.
4. WHEN a new DailyPlan is created for a Site, THE System SHALL send a push notification to all Supervisors assigned to that Site who have an active push subscription.
5. WHEN a DailyReport is submitted, THE System SHALL send a push notification to all Admins who have an active push subscription.
6. WHEN a resource is marked as arrived, THE System SHALL send a push notification to all Admins who have an active push subscription.
7. WHEN a SitePhoto is uploaded, THE System SHALL send a push notification to all Admins who have an active push subscription.
8. IF a push notification delivery fails for a specific subscription (e.g., the subscription has expired), THEN THE System SHALL remove the stale subscription from the database and SHALL NOT retry delivery to that subscription.
9. THE System SHALL send push notifications as fire-and-forget operations and SHALL NOT block the primary API response while delivering notifications.

---

### Requirement 18: Progressive Web App (PWA)

**User Story:** As a Supervisor or Admin on a mobile device, I want to install the app on my home screen and access read-only views offline, so that I can use the app like a native application without an internet connection.

#### Acceptance Criteria

1. THE System SHALL provide a Web App Manifest (`manifest.json`) with at minimum: `name`, `short_name`, `start_url`, `display: "standalone"`, `background_color`, `theme_color`, and at least one icon in PNG format at 192×192 and 512×512 pixels.
2. THE System SHALL register a Service Worker that caches the application shell (HTML, CSS, JavaScript bundles) using a cache-first strategy so that the app loads without a network connection.
3. WHILE the device is offline, THE System SHALL serve previously cached plan and site data for read-only viewing in the Admin dashboard and Supervisor execution view.
4. WHILE the device is offline, THE System SHALL display a clearly visible "You are offline" indicator and SHALL disable all write actions (plan creation, resource arrival, photo upload, DPR submission).
5. WHEN the device comes back online, THE System SHALL remove the offline indicator and re-enable write actions without requiring a full page reload.
6. THE System SHALL support installation via the browser's "Add to Home Screen" prompt on iOS Safari and Android Chrome.
7. WHERE the app is launched from the home screen in standalone mode, THE System SHALL hide the browser navigation chrome and display the app in full-screen layout.
