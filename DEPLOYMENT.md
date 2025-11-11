# Coolify Deployment Guide for PEXP

## Prerequisites

1. **Coolify Server**: Access to a Coolify instance
2. **GitHub Repository**: Code pushed to GitHub (already done: `radion-x/pexp_5`)
3. **PostgreSQL Database**: Either use Coolify's PostgreSQL or external database

---

## Deployment Steps

### Option 1: Deploy with Coolify's PostgreSQL (Recommended)

#### Step 1: Create PostgreSQL Database in Coolify

1. Log into your Coolify dashboard
2. Go to **Databases** → **+ Add Database**
3. Select **PostgreSQL**
4. Configure:
   - **Name**: `pexp-postgres`
   - **Version**: `16` (or latest)
   - **Database Name**: `pexp_db`
   - **Username**: `pexp_user`
   - **Password**: Generate a secure password
5. Click **Save** and wait for it to deploy
6. Note the **Internal URL** (e.g., `pexp-postgres:5432`)

#### Step 2: Deploy the Application

1. In Coolify, go to **Applications** → **+ Add Application**
2. Select **Public Repository**
3. Configure:
   - **Repository URL**: `https://github.com/radion-x/pexp_5`
   - **Branch**: `main`
   - **Build Pack**: `Dockerfile`
   - **Port**: `3000`

4. **Environment Variables** - Add these:

```env
# Node Environment
NODE_ENV=production
PORT=3000

# Database (Use internal Coolify database URL)
DATABASE_URL=postgresql://pexp_user:YOUR_PASSWORD@pexp-postgres:5432/pexp_db

# Claude AI
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_MODEL=claude-sonnet-4-5-20250929

# Email Configuration
EMAIL_SENDER_ADDRESS=your-sender@example.com
EMAIL_RECIPIENT_ADDRESS=clinic@example.com
BCC_EMAIL_RECIPIENT_ADDRESS=admin@example.com

# Mailgun
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_SMTP_SERVER=smtp.mailgun.org
MAILGUN_SMTP_PORT=587
MAILGUN_SMTP_LOGIN=your-sender@example.com
MAILGUN_SMTP_PASSWORD=your_mailgun_smtp_password_here

# Dashboard (if needed)
DASHBOARD_PASSWORD=your_secure_password_here
```

5. **Health Check Path**: `/api/health`

6. Click **Deploy**

#### Step 3: Initialize Database Schema

After first deployment, you need to run the schema:

1. In Coolify, go to your PostgreSQL database
2. Click **Terminal** or **Execute**
3. Run:
```bash
psql -U pexp_user -d pexp_db < /path/to/schema.sql
```

Or connect via command line:
```bash
psql postgresql://pexp_user:PASSWORD@your-coolify-host:PORT/pexp_db -f database/schema.sql
```

---

### Option 2: Deploy with docker-compose

If your Coolify supports docker-compose:

1. Push your code including `docker-compose.yml`
2. In Coolify, select **Docker Compose**
3. Set environment variables (same as above)
4. Deploy

The docker-compose will automatically:
- Create PostgreSQL with the schema
- Build and start the app
- Connect them together

---

## Post-Deployment

### 1. Verify Deployment

Visit your Coolify-assigned URL:
- **Homepage**: `https://your-app.coolify.io/`
- **Health Check**: `https://your-app.coolify.io/api/health`

Expected health check response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-11T...",
  "version": "abc1234"
}
```

### 2. Test Database Connection

Check app logs in Coolify for:
```
✅ PostgreSQL connected successfully: 2025-11-11T...
```

### 3. Test Form Submission

1. Fill out the patient intake form
2. Submit it
3. Check:
   - Database for the new entry
   - Email delivery
   - App logs

### 4. Access Database

To query your database from another app, use the **Public URL** from Coolify:
```
postgresql://pexp_user:PASSWORD@your-coolify-host:PUBLIC_PORT/pexp_db
```

---

## Troubleshooting

### App Won't Start

**Check logs for:**
- `❌ PostgreSQL connection error` → Database URL is wrong
- Port already in use → Change PORT env variable
- Missing environment variables → Add them in Coolify

### Database Connection Failed

1. Verify DATABASE_URL format:
   ```
   postgresql://username:password@host:port/database
   ```
2. Ensure PostgreSQL is running (check Coolify database status)
3. Check network connectivity between app and database

### Schema Not Applied

Run manually:
```bash
# SSH into your app container
docker exec -it pexp-app sh

# Apply schema
psql $DATABASE_URL -f database/schema.sql
```

---

## Updating the App

### Manual Deployment
1. Push changes to GitHub
2. In Coolify, click **Redeploy**

### Auto-Deploy (Webhook)
1. In Coolify, go to your app settings
2. Copy the **Webhook URL**
3. In GitHub:
   - Go to **Settings** → **Webhooks**
   - Add webhook with the Coolify URL
   - Set trigger: **Push events**
4. Now every git push auto-deploys!

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLAUDE_API_KEY` | Yes | Anthropic API key for AI summaries |
| `CLAUDE_MODEL` | No | Claude model (default: claude-3-5-sonnet-20241022) |
| `EMAIL_SENDER_ADDRESS` | Yes | Mailgun sender email |
| `EMAIL_RECIPIENT_ADDRESS` | Yes | Clinic notification email |
| `MAILGUN_API_KEY` | Yes | Mailgun API key |
| `MAILGUN_SMTP_*` | Yes | Mailgun SMTP credentials |
| `BCC_EMAIL_RECIPIENT_ADDRESS` | No | BCC recipient for notifications |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Set to 'production' |

---

## Database Backups

### Manual Backup
```bash
pg_dump postgresql://pexp_user:PASSWORD@host:port/pexp_db > backup.sql
```

### Restore from Backup
```bash
psql postgresql://pexp_user:PASSWORD@host:port/pexp_db < backup.sql
```

### Automated Backups
Configure in Coolify's PostgreSQL settings:
- Enable automatic backups
- Set retention period
- Configure backup schedule

---

## Monitoring

### Health Check
Coolify automatically monitors `/api/health` endpoint

### Database Stats
Query submission statistics:
```sql
SELECT 
  COUNT(*) as total_submissions,
  AVG(pain_intensity) as avg_pain_intensity,
  COUNT(DISTINCT email) as unique_patients
FROM patient_submissions;
```

### Logs
View real-time logs in Coolify dashboard:
- Application logs
- Database logs
- Error tracking

---

## Security Checklist

- [ ] Environment variables are set (not committed to git)
- [ ] `.env` file is in `.gitignore`
- [ ] Database has strong password
- [ ] HTTPS is enabled (Coolify handles this)
- [ ] Health check endpoint is public
- [ ] API keys are rotated regularly
- [ ] Database backups are enabled

---

## Support

For issues:
1. Check Coolify logs
2. Check application logs
3. Verify environment variables
4. Test database connectivity
5. Review this guide

Need help? Check:
- Coolify Documentation: https://coolify.io/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/
