# CodePath Backend

Backend for CodePath - AI-powered competitive programming platform. Node.js/Express API serving personalized training, CodePrint analytics, and Codeforces integration for ICPC preparation.

## 🚀 Features

- **Express.js API** - RESTful API with TypeScript support
- **PostgreSQL Database** - Robust data persistence with Prisma ORM
- **Docker Integration** - Containerized PostgreSQL for development
- **Authentication** - JWT-based user authentication with bcrypt
- **File Upload** - Multer integration for file handling
- **CORS Support** - Cross-origin resource sharing enabled
- **Request Logging** - Morgan middleware for HTTP request logging
- **Hot Reload** - Nodemon for development with automatic restarts
- **Quiz Questions CRUD** - Manage quiz questions; list returns only `questionTitle` and `createdAt`
- **Email Broadcast** - Send announcements to all mentees via SMTP (Gmail)

## 📋 Prerequisites

Before running this project, make sure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v10.11.0 or higher)
- **Docker** and **Docker Compose**
- **Git**

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/farah-fahhoum/codepath-backend.git
cd codepath-backend
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (Docker PostgreSQL)
DATABASE_URL="postgresql://codepath-admin:123qweAsd@localhost:5432/codepath?schema=public"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=20971520

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Email (SMTP via Gmail)
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_APP_PASSWORD=your-google-app-password
```

### 4. Quick Development Setup

Run the automated development setup:

```bash
pnpm setup:dev
```

This command will:

- Start the PostgreSQL Docker container
- Generate Prisma client
- Run database migrations

### 5. Start Development Server

```bash
pnpm dev
```

The server will start at `http://localhost:3000`

## 🐳 Docker Commands

| Command            | Description                |
| ------------------ | -------------------------- |
| `pnpm docker:up`   | Start PostgreSQL + Piston  |
| `pnpm docker:down` | Stop containers            |
| `pnpm docker:logs` | View PostgreSQL logs       |

### Self-hosted Piston (code execution)

Public `emkc.org` Piston is not used. After `docker compose up -d piston`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-piston-runtimes.ps1
```

Set `PISTON_BASE_URL=http://127.0.0.1:2000` in `.env` (default). Piston listens on port **2000**.

Installs `python`, `node` (javascript), `java`, then `gcc` (c/c++). The `gcc` package can take a long time on first install; retry the script if it reports residual files.

## 🗄️ Database Commands

| Command                | Description                           |
| ---------------------- | ------------------------------------- |
| `pnpm db:generate`     | Generate Prisma client                |
| `pnpm db:migrate`      | Run database migrations (development) |
| `pnpm db:migrate:prod` | Deploy migrations (production)        |
| `pnpm db:reset`        | Reset database and run migrations     |
| `pnpm db:studio`       | Open Prisma Studio (database GUI)     |
| `pnpm db:seed`         | Seed database with initial data       |
| `pnpm db:push`         | Push schema changes to database       |

## 🏗️ Build Commands

| Command         | Description                      |
| --------------- | -------------------------------- |
| `pnpm build`    | Compile TypeScript to JavaScript |
| `pnpm start:js` | Run compiled JavaScript version  |
| `pnpm start:ts` | Run TypeScript version directly  |
| `pnpm dev`      | Development mode with hot reload |

## 🏗️ Project Structure

```
codepath-backend/
├── src/
│   └── app.ts              # Main application file
├── prisma/
│   └── schema.prisma       # Database schema
├── docker-compose.yml      # Docker configuration
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── nodemon.json           # Nodemon configuration
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔧 Development Workflow

1. **Start Development Environment**

   ```bash
   pnpm setup:dev
   pnpm dev
   ```

2. **Make Database Changes**

   ```bash
   # Edit prisma/schema.prisma
   pnpm db:migrate
   ```

3. **View Database**

   ```bash
   pnpm db:studio
   ```

4. **Check Logs**
   ```bash
   pnpm docker:logs
   ```

## 🛡️ Environment Variables

| Variable         | Description                  | Default                 |
| ---------------- | ---------------------------- | ----------------------- |
| `NODE_ENV`       | Environment mode             | `development`           |
| `PORT`           | Server port                  | `3000`                  |
| `DATABASE_URL`   | PostgreSQL connection string | See .env.example        |
| `JWT_SECRET`     | JWT signing secret           | Required                |
| `JWT_EXPIRES_IN` | JWT expiration time          | `7d`                    |
| `MAX_FILE_SIZE`  | Maximum upload file size     | `20971520` (20MB)       |
| `CORS_ORIGIN`    | Allowed CORS origins         | `http://localhost:3000` |
| `EMAIL_ADDRESS`  | SMTP sender email (Gmail)    | Required                |
| `EMAIL_APP_PASSWORD` | Gmail App Password           | Required                |
| `FASTAPI_BASE_URL` | URL of the companion FastAPI service | `http://127.0.0.1:8000` |
| `PISTON_BASE_URL` | Self-hosted Piston API base URL | `http://127.0.0.1:2000` |
| `PISTON_API_KEY` | Optional Authorization header for Piston | (unset) |

## 🔍 Troubleshooting

### Database Connection Issues

1. **Check if PostgreSQL container is running:**

   ```bash
   docker ps
   ```

2. **Restart the database:**

   ```bash
   pnpm docker:down
   pnpm docker:up
   ```

3. **Check database logs:**
   ```bash
   pnpm docker:logs
   ```

### Authentication Errors

- Ensure the `DATABASE_URL` password matches the one in `docker-compose.yml`
- Special characters in passwords should be URL-encoded
- Ensure `JWT_SECRET` is set and matches token generation logic
- For Gmail SMTP, create an App Password (requires 2FA) and use it in `EMAIL_APP_PASSWORD`

### Port Conflicts

- Change the `PORT` in `.env` if port 3000 is already in use
- Update the PostgreSQL port in `docker-compose.yml` if port 5432 conflicts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests and ensure code quality
5. Commit your changes: `git commit -m 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📝 License

This project is part of the BPR601 course at SVU.

## 🆘 Support

For support and questions:

- Check the troubleshooting section above
- Review the Docker and database logs
- Ensure all environment variables are properly configured
## 📚 API Endpoints

### Authentication
- `POST /auth/login` — Log in as mentee or admin. Body: `{ email, password }`. Returns `accessToken`.
- `POST /auth/mentee/register` — Register a mentee. Body: `{ fullName, username, email, password, country, phone?, bio? }`. Returns `accessToken`.
- `POST /auth/logout` — Log out. Send the `Authorization: Bearer <accessToken>` header. The client should also discard the stored token (JWTs are stateless).

### Codeforces Integration
- `POST /external-accounts/codeforces/integrate` — Link your Codeforces handle. Body: `{ handle }`. Computes your CodePath level and activates your roadmap.
- `GET /external-accounts/codeforces/integration` — Check whether a handle is linked (`{ linked, handle, isVerified, codePathLevel }`).

### Quiz Questions
- `POST /quiz/questions` — Create a quiz question
  - Body: `{ questionTitle: string, answer: string, score: number }`
- `GET /quiz/questions` — List questions
  - Returns array of `{ questionTitle, createdAt }` only
- `GET /quiz/questions/:id` — Get a question by ID
- `PUT /quiz/questions/:id` — Update a question
- `DELETE /quiz/questions/:id` — Delete a question

### Contact / Email Broadcast
- Function: broadcasts email to all mentees using `EMAIL_ADDRESS` and `EMAIL_APP_PASSWORD`
- Uses BCC for privacy; ensure `Mentee` role exists and users have emails.

## 🤖 AI-Powered Features

These features call the companion FastAPI service (`CodePath_AI_fastapi`). Start it first and set `FASTAPI_BASE_URL` (default `http://127.0.0.1:8000`) in `.env`.

| Feature | Node route | Calls FastAPI |
| --- | --- | --- |
| Dynamic AI Roadmap | `POST /roadmaps/generate-my-roadmap` | `POST /api/roadmap/generate` |
| Virtual Contests | `POST /contests/create` with `selection` | `POST /api/contest/select-problems` |
| Reference Library AI curation | `POST /reference/curate` | `POST /api/reference/curate` |

All three callers fall back to deterministic responses when Gemini is unreachable, so the backend still works offline.

### Roadmaps (AI)
- `POST /roadmaps/generate-my-roadmap` — Generates a personalized roadmap from the user's topics, quiz performance, Codeforces stats and skill level, then persists it as a personal roadmap.

### Contests
- `GET /contests` — List all contests
- `GET /contests/my` — Contests the user joined
- `POST /contests/create` — Admin. Body: `{ title, description?, durationMinutes, freezeEnabled?, freezeMinutes?, problems?: [{problemId, topicId?}] | selection?: { targetSkillTier, topics: [{id?, title}], totalProblems } }`
- `GET /contests/:id` — Contest details including labeled problems (A, B, C...)
- `POST /contests/:id/join` — Join a contest
- `POST /contests/:id/start` — Start the personal virtual timer
- `POST /contests/:id/submissions` — Body: `{ contestProblemId, verdict, programmingLanguage }`. Verdicts: `AC`, `WA`, `TLE`, `MLE`, `RE`, `CE`, `SKIPPED`. Scoring uses virtual time with a 20-minute penalty per wrong attempt (CE ignored).
- `POST /contests/:id/finish` — Stop the timer for the user
- `GET /contests/:id/scoreboard?final=true` — Scoreboard with freeze applied (`?final=true` for the unfrozen admin view)
- `GET /contests/:id/my-submissions` — The user's submissions in the contest
- `POST /contests/:id/complete` / `POST /contests/:id/cancel` / `DELETE /contests/:id` — Admin lifecycle actions

### Coaches & Bookings
- `GET /coaches` / `GET /coaches/:id` — Coach directory
- `POST /coaches` — Admin-only. Create a coach account with `{ name, username, email, password, country, specialty, bio?, phone?, hourlyRate?, isAvailable?, bookingLink? }`
- `GET /coaches/me` / `POST /coaches/me` — Coach-only. View or update the authenticated coach's profile
- `POST /coaches/:id/bookings` — Request a booking `{ startTime, endTime, notes? }`
- `GET /coaches/bookings/me` — My bookings as a mentee
- `GET /coaches/bookings/coach` — My bookings as a coach
- `PATCH /coaches/bookings/:id` — `{ status: PENDING|CONFIRMED|COMPLETED|CANCELLED, meetingUrl? }` (coach/admin; mentee may cancel their own)
- `POST /coaches/webhook/cal` — Cal.com webhook. Verify the `x-cal-signature` header (HMAC-SHA256 of the raw body with `CAL_WEBHOOK_SECRET`) before syncing bookings.

### Reference Library
- `POST /reference` — Save a snippet `{ title, language, code, topicId?, notes?, tags?, isPublic? }`
- `GET /reference?topicId=&search=` — List my snippets
- `GET /reference/:id` — View a snippet (owners or public)
- `PUT /reference/:id` / `DELETE /reference/:id` — Update/delete my snippet
- `POST /reference/curate` — Group snippets into a weakness-ordered study sheet via FastAPI
- `GET /reference/export/pdf` — Download all my snippets as one highlighted PDF
- `GET /reference/export/zip` — Download a ZIP of per-snippet PDFs plus `metadata.json`
- `GET /reference/:id/pdf` — Download one snippet as PDF

### Similar-Peer Recommendation
- `GET /users/mentees/nearby?country=&city=&minRating=&limit=` — Mentees ranked by similarity (rating, accuracy, problems solved, geography).

## 🧪 Postman
Import `postman/codepath-backend.postman_collection.json` and `postman/codepath-backend.postman_environment.json` in Postman. Login first — the `accessToken` is stored in the `token` variable automatically.

## 🚀 Running Both Projects Together

The Node backend calls the FastAPI service for AI features (roadmap, contests, reference curation). Start FastAPI first, then the backend.

### 1. FastAPI (`CodePath_AI_fastapi`)

```bash
# Option A — Docker Compose (recommended)
docker compose up -d --build

# Option B — local Python
python -m venv venv
venv\Scripts\Activate.ps1        # Windows PowerShell
source venv/bin/activate         # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload
```

FastAPI runs at `http://127.0.0.1:8000` (Swagger UI at `/docs`).

### 2. Node Backend (`codepath-backend`)

```bash
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, FASTAPI_BASE_URL
pnpm setup:dev         # start PostgreSQL + generate Prisma client + migrate
pnpm dev
```

Backend runs at `http://localhost:3000`.
