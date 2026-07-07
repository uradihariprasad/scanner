# Deploy to Render

## Render Settings

| Field | Value |
|-------|-------|
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

### Environment Variables

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(Internal Database URL from Render PostgreSQL)* |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |

---

## Steps

### 1. Push to GitHub

```bash
git add .
git commit -m "deploy"
git push origin main
```

### 2. Create Database

Render Dashboard → **New +** → **PostgreSQL** → Name: `momentum-scanner-db`, Database: `app_db`, Plan: Free → Create → Copy **Internal Database URL**

### 3. Create Web Service

Render Dashboard → **New +** → **Web Service** → Connect repo → Set Build/Start commands and env vars above → Create

### 4. Open App

`https://momentum-scanner.onrender.com` → Enter Upstox access token → Done

---

## How It Works

`npm start` runs `server.js` which:
1. Connects to PostgreSQL and creates tables automatically
2. Starts Next.js server on the correct port

No drizzle-kit needed at build time. No shell scripts. Just Node.
