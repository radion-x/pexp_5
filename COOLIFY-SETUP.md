# EXACT Coolify Deployment Steps

## Choose Your Deployment Method

You have **2 options**:

---

## ✅ OPTION 1: Single Project (Recommended - Easiest)

Deploy as **ONE application** using docker-compose. This automatically sets up both PostgreSQL and your app together.

### Step-by-Step:

#### 1. Create New Resource in Coolify

1. Log into Coolify
2. Click **+ New Resource**
3. Select **Docker Compose**
4. Choose **Empty Service** or **From Git**

#### 2. Configure the Application

**If using Git:**
- **Repository**: `https://github.com/radion-x/pexp_5`
- **Branch**: `main`
- **Docker Compose Location**: `docker-compose.yml` (root)

**If using Empty Service:**
- Paste the contents of `docker-compose.yml`

#### 3. Set Environment Variables

In Coolify's environment variable section, add these:

```bash
# PostgreSQL (for docker-compose)
POSTGRES_PASSWORD=YourSecurePassword123!

# Claude AI (copy from your .env)
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_MODEL=claude-sonnet-4-5-20250929

# Email (copy from your .env)
EMAIL_SENDER_ADDRESS=your-email@example.com
EMAIL_RECIPIENT_ADDRESS=recipient@example.com
BCC_EMAIL_RECIPIENT_ADDRESS=admin@example.com

# Mailgun (copy from your .env)
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_SMTP_SERVER=smtp.mailgun.org
MAILGUN_SMTP_PORT=587
MAILGUN_SMTP_LOGIN=your-email@example.com
MAILGUN_SMTP_PASSWORD=your_mailgun_smtp_password_here

# Dashboard
DASHBOARD_PASSWORD=your_secure_password_here
```

**Note:** The `DATABASE_URL` is NOT needed - docker-compose sets it automatically!

#### 4. Configure Port Mapping

Coolify will detect port `3000` from docker-compose. Make sure it's exposed.

#### 5. Deploy

Click **Deploy** and wait ~2-3 minutes.

#### 6. What Happens Automatically:

- ✅ PostgreSQL container starts
- ✅ Database `pexp_db` is created
- ✅ Schema is automatically loaded from `database/schema.sql`
- ✅ App container builds and starts
- ✅ App connects to PostgreSQL
- ✅ Health checks run

#### 7. Access Your App

Coolify will give you a URL like:
- `https://pexp-randomid.coolify.io`

Test it:
- Homepage: `https://your-url/`
- Health: `https://your-url/api/health`

---

## OPTION 2: Two Separate Projects (More Control)

Deploy PostgreSQL and the app as **TWO separate services**.

### Part A: Create PostgreSQL Database

#### 1. Create Database in Coolify

1. Go to **+ New Resource**
2. Select **Database** → **PostgreSQL**
3. Configure:
   - **Name**: `pexp-postgres`
   - **Database Name**: `pexp_db`
   - **Username**: `pexp_user`
   - **Password**: Generate a strong password (save it!)
   - **Version**: `16` or `latest`
4. Click **Create**
5. Wait for it to start

#### 2. Get Database Connection Details

After PostgreSQL starts, Coolify shows:
- **Internal URL**: `pexp-postgres:5432` (use this for your app)
- **Public URL**: `your-server-ip:XXXXX` (for external access)

**Your DATABASE_URL will be:**
```
postgresql://pexp_user:YOUR_PASSWORD@pexp-postgres:5432/pexp_db
```

#### 3. Initialize Schema

Open PostgreSQL terminal in Coolify and run:
```bash
psql -U pexp_user -d pexp_db
```

Then paste the contents of `database/schema.sql` or run:
```bash
# If schema file is accessible
psql -U pexp_user -d pexp_db < /path/to/schema.sql
```

### Part B: Deploy Application

#### 1. Create Application in Coolify

1. Go to **+ New Resource**
2. Select **Application**
3. Choose **Public Repository**
4. Configure:
   - **Repository**: `https://github.com/radion-x/pexp_5`
   - **Branch**: `main`
   - **Build Pack**: `Dockerfile`
   - **Port**: `3000`
   - **Health Check Path**: `/api/health`

#### 2. Set Environment Variables

Add these in the application's environment variables:

```bash
# Node
NODE_ENV=production
PORT=3000

# Database - Use internal Coolify URL
DATABASE_URL=postgresql://pexp_user:YOUR_PASSWORD@pexp-postgres:5432/pexp_db

# Claude AI
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_MODEL=claude-sonnet-4-5-20250929

# Email
EMAIL_SENDER_ADDRESS=your-email@example.com
EMAIL_RECIPIENT_ADDRESS=recipient@example.com
BCC_EMAIL_RECIPIENT_ADDRESS=admin@example.com

# Mailgun
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_SMTP_SERVER=smtp.mailgun.org
MAILGUN_SMTP_PORT=587
MAILGUN_SMTP_LOGIN=your-email@example.com
MAILGUN_SMTP_PASSWORD=your_mailgun_smtp_password_here

# Dashboard
DASHBOARD_PASSWORD=your_secure_password_here
```

#### 3. Connect to Database

In Coolify, make sure both services are in the **same network** or the app can reach the database.

#### 4. Deploy

Click **Deploy** and wait for the build.

#### 5. Verify

Check app logs for:
```
✅ PostgreSQL connected successfully: 2025-11-11T...
```

---

## Comparison

| Feature | Option 1 (docker-compose) | Option 2 (Separate) |
|---------|---------------------------|---------------------|
| **Setup Steps** | 1 project | 2 projects |
| **Complexity** | Easy | Medium |
| **Database Setup** | Automatic | Manual |
| **Schema Loading** | Automatic | Manual |
| **Best For** | Quick deployment | More control |
| **Recommended** | ✅ Yes | If you need separate DB |

---

## My Recommendation: USE OPTION 1

**Why?**
- ✅ One-click deployment
- ✅ Schema loads automatically
- ✅ Database and app are always connected
- ✅ Easier to manage
- ✅ Can still access database from other apps

---

## After Deployment (Both Options)

### 1. Test the App

Visit your Coolify URL and submit a test form.

### 2. Check Database

In Coolify PostgreSQL terminal:
```sql
SELECT COUNT(*) FROM patient_submissions;
```

Should show your test submission.

### 3. Access from Another App

Use the **Public URL** from Coolify:
```
postgresql://pexp_user:PASSWORD@your-coolify-server.com:PUBLIC_PORT/pexp_db
```

Or if both apps are in Coolify, use **Internal URL**:
```
postgresql://pexp_user:PASSWORD@pexp-postgres:5432/pexp_db
```

---

## Troubleshooting

### "Can't connect to database"

**If using Option 1 (docker-compose):**
- Check if both containers started (should see 2 services)
- Check app logs for connection errors

**If using Option 2:**
- Verify both services are in same network
- Check DATABASE_URL is correct
- Test database is running: Check PostgreSQL logs

### "Schema not found"

**Option 1:** Schema should auto-load. If not, check docker-compose mounted the volume correctly.

**Option 2:** Manually run schema in PostgreSQL terminal.

### "Health check failing"

- Check app logs for errors
- Verify port 3000 is exposed
- Test: `curl http://app-container:3000/api/health` from Coolify terminal

---

## Questions?

- Is your app in Coolify now?
- Did you choose Option 1 or 2?
- Any errors during deployment?

Let me know and I'll help troubleshoot! 🚀
