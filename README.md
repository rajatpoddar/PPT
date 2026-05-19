# PPT Builders

A mobile-first construction site management app for real-time civil project tracking. Admins create next-day plans with goals, resource lineups, and voice instructions. Supervisors execute on-site — marking resource arrivals, uploading photos, and submitting end-of-day Daily Progress Reports (DPR). Admins watch it all unfold on a live timeline without leaving the office.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS + Lucide Icons |
| Auth | NextAuth.js (JWT, Credentials provider) |
| ORM | Prisma 5 |
| Database | SQLite (dev) |
| Validation | Zod + react-hook-form |
| Media Storage | Local filesystem (dev), S3 / Cloudinary (prod) |
| Testing | Jest + fast-check (property-based) |

---

## Roles

- **Admin** — creates plans, monitors the live timeline, manages sites
- **Supervisor** — executes the plan, marks resources arrived, uploads photos, submits DPR

---

## Prerequisites

- Node.js 18+
- npm 9+

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env and fill in your values:

```bash
cp .env .env.local
```

`.env` defaults (works out of the box for local dev):

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
MEDIA_BACKEND="local"
```

> Change `NEXTAUTH_SECRET` to any random string before running. You can generate one with `openssl rand -base64 32`.

### 3. Set up the database

Run migrations to create the SQLite schema:

```bash
npx prisma migrate dev --name init
```

Seed the database with default users and sites:

```bash
npm run prisma:seed
```

This creates:

| Username | Password | Role | Assigned Site |
|---|---|---|---|
| `admin` | `admin123` | Admin | — |
| `supervisor` | `supervisor123` | Supervisor | Main Construction Site |

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

All tests run serially (SQLite requires it):

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

The test suite includes:
- **Property-based tests** (fast-check) covering all 25 correctness properties
- **Integration tests** covering end-to-end flows (plan creation, execution, DPR, media, SSE timeline)

Tests use a separate isolated database at `prisma/test.db` — your dev data is never touched.

---

## Project Structure

```
app/
├── (admin)/          # Admin pages: dashboard, sites, plans
├── (auth)/           # Login page
├── (supervisor)/     # Supervisor pages: execution view, DPR form
└── api/              # API routes (auth, plans, sites, resources, photos, dpr, timeline)

components/           # Shared UI components
lib/
├── media/            # MediaService interface + Local/S3/Cloudinary implementations
├── validations/      # Zod schemas (site, plan, dpr)
├── auth.ts           # NextAuth authorize logic
├── routeAccess.ts    # Role-based route access helper
└── mediaAccess.ts    # Media file access control helper

prisma/
├── schema.prisma     # Database schema
├── seed.ts           # Dev seed script
└── migrations/       # Migration history

__tests__/            # Property-based and integration tests
```

---

## Key URLs

| URL | Who | What |
|---|---|---|
| `/login` | Everyone | Login page |
| `/admin/dashboard` | Admin | Live timeline + site list |
| `/admin/sites` | Admin | Manage sites |
| `/admin/plans/new` | Admin | Create a daily plan |
| `/supervisor/execution` | Supervisor | Morning briefing + resource checklist + photo upload |
| `/supervisor/dpr` | Supervisor | Submit end-of-day DPR |

---

## Media Storage

Controlled by the `MEDIA_BACKEND` env var:

| Value | Description |
|---|---|
| `local` | Saves files to `public/uploads/YYYY/MM/` — default for dev |
| `s3` | AWS S3 (stub — configure credentials to activate) |
| `cloudinary` | Cloudinary (stub — configure credentials to activate) |

Uploaded files are served only to authenticated users.

---

## Useful Commands

```bash
# Regenerate Prisma client after schema changes
npm run prisma:generate

# Create a new migration
npm run prisma:migrate

# Re-seed the dev database
npm run prisma:seed

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Build for production
npm run build

# Start production server
npm start
```
