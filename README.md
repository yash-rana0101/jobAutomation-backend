# JobAutomation — Backend API

REST API for the AI Cold Email Outreach system. Built with **Express 5**, **Prisma 7**, and **Anthropic Claude**.

---

## Tech Stack

| Layer         | Technology                             |
| ------------- | -------------------------------------- |
| Runtime       | Node.js + TypeScript (`tsx`)           |
| Framework     | Express 5                              |
| ORM           | Prisma 7 + `@prisma/adapter-pg`        |
| Database      | PostgreSQL 16                          |
| Queue / Cache | Redis 7 + BullMQ                       |
| AI            | Anthropic Claude (`claude-opus-4-5`)   |
| Web Scraping  | Firecrawl API (+ basic fetch fallback) |
| Email         | Nodemailer via Zoho SMTP               |
| File Upload   | Multer + xlsx (Excel parsing)          |

---

## Project Structure

```
api/
├── src/
│   ├── app.ts                  # Express entry point, route registration
│   ├── config/
│   │   └── database.ts         # Prisma client singleton (adapter-pg)
│   ├── modules/
│   │   ├── ai/                 # Company analysis + email drafting (Claude)
│   │   ├── ats/                # ATS resume scoring via AI
│   │   ├── companies/          # Company CRUD
│   │   ├── crawler/            # Firecrawl + fetch fallback
│   │   ├── dashboard/          # Stats aggregation
│   │   ├── email/              # Zoho SMTP sender
│   │   ├── outreach/           # Full pipeline orchestration controller
│   │   ├── resume/             # AI resume generation + ATS loop
│   │   └── uploads/            # Multer + Excel parser
│   └── scripts/
│       └── preflight.ts        # Pre-flight connection test script
├── prisma/
│   └── schema.prisma           # DB schema (Company, CrawlData, CompanyAnalysis, Outreach)
├── prisma.config.ts            # Prisma 7 config (datasource URL for CLI)
├── docker-compose.yml          # PostgreSQL 16 + Redis 7
├── .env.example                # Environment variable template
└── tsconfig.json
```

---

## Getting Started

### 1. Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL + Redis)
- A [Firecrawl](https://firecrawl.dev) API key
- An [Anthropic](https://console.anthropic.com) API key
- Zoho (or other) SMTP credentials

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

```env
ANTHROPIC_API_KEY=sk-ant-...
FIRECRAWL_API_KEY=fc-...
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/job_automation"
REDIS_URL=redis://localhost:6379
ZOHO_SMTP_HOST=smtp.zoho.in
ZOHO_SMTP_PORT=587
ZOHO_SMTP_USER=you@yourdomain.com
ZOHO_SMTP_PASSWORD=yourpassword
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 4. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.

### 5. Run database migrations

```bash
npm run db:migrate
```

### 6. Run pre-flight checks

Validates all external connections before starting the server:

```bash
npm run preflight
```

Expected output when everything is ready:

```
✔  PostgreSQL
✔  Redis
✔  SMTP
✔  Firecrawl
✔  Anthropic

All required services are ready. You can start the server.
```

### 7. Start the development server

```bash
npm run dev
```

Server runs on `http://localhost:4000`.

---

## API Routes

| Method   | Route                              | Description                         |
| -------- | ---------------------------------- | ----------------------------------- |
| `GET`    | `/api/health`                      | Health check                        |
| `GET`    | `/api/companies`                   | List all companies                  |
| `POST`   | `/api/companies`                   | Create a company                    |
| `DELETE` | `/api/companies/:id`               | Delete a company                    |
| `GET`    | `/api/dashboard/stats`             | Outreach pipeline stats             |
| `POST`   | `/api/upload/excel`                | Upload Excel file with company list |
| `GET`    | `/api/outreach`                    | List all outreach records           |
| `GET`    | `/api/outreach/:companyId`         | Get outreach detail for a company   |
| `POST`   | `/api/outreach/:companyId/start`   | Start pipeline for a company        |
| `POST`   | `/api/outreach/:companyId/approve` | Approve email for sending           |
| `POST`   | `/api/outreach/:companyId/send`    | Send approved email                 |
| `POST`   | `/api/outreach/:companyId/reject`  | Reject / reset outreach             |

---

## Outreach Pipeline

Each company goes through this automated pipeline once triggered:

```
pending → crawling → analyzing → generating_resume → ats_checking → drafting_email → ready_for_review
                                                                                            ↓
                                                                              approved → sending → sent
```

Human review happens at the `ready_for_review` stage before approval and sending.

---

## Database Schema

### Models

- **`Company`** — Target company with name, website, email, and optional socials
- **`CrawlData`** — Raw HTML + markdown scraped from the company's website
- **`CompanyAnalysis`** — AI-extracted: industry, product, tech stack, hiring signals, relevance score
- **`Outreach`** — Pipeline state, generated resume path, ATS score, email subject/body, timestamps

### Status Enum (`OutreachStatus`)

`pending` → `crawling` → `analyzing` → `generating_resume` → `ats_checking` → `drafting_email` → `ready_for_review` → `approved` → `sending` → `sent` / `failed` / `rejected` / `replied`

---

## npm Scripts

| Script                | Description                                    |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Start dev server with hot reload (`tsx watch`) |
| `npm run build`       | Compile TypeScript to `dist/`                  |
| `npm start`           | Run compiled production build                  |
| `npm run preflight`   | Check all external connections                 |
| `npm run db:migrate`  | Run Prisma migrations                          |
| `npm run db:push`     | Push schema without migration history          |
| `npm run db:generate` | Regenerate Prisma client                       |

---

## Notes

- **Prisma 7** requires a driver adapter — the `PrismaPg` adapter is passed directly to the `PrismaClient` constructor. There is no `url` field in `prisma/schema.prisma`; the URL lives in `prisma.config.ts` (used by the CLI) and in the runtime adapter constructor.
- Uploaded Excel files are stored in `uploads/` and served statically at `/uploads/*`.
- AI features (analysis, resume, email drafting) require a valid `ANTHROPIC_API_KEY`. Without it the pipeline will fail at the `analyzing` stage.
