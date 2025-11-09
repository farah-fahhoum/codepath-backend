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
| `pnpm docker:up`   | Start PostgreSQL container |
| `pnpm docker:down` | Stop PostgreSQL container  |
| `pnpm docker:logs` | View PostgreSQL logs       |

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
