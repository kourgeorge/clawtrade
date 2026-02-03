# Clawtrade – Ubuntu deployment steps

Exact steps to install the website on Ubuntu (works on 22.04 LTS and newer).

---

## 1. Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Verify
node -v   # v20.x.x
npm -v
```

---

## 2. PostgreSQL (choose one)

### Option A: Docker (recommended)

```bash
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and back in for group to take effect, or run: newgrp docker
```

### Option B: System PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

---

## 3. Clone and enter project

```bash
cd /opt
sudo git clone git@github.com:kourgeorge/clawtrade.git
sudo chown -R $USER:$USER clawtrade
cd clawtrade
```

Requires SSH keys configured for GitHub. Or use HTTPS: `https://github.com/kourgeorge/clawtrade.git`

---

## 4. Database setup

### If using Docker for Postgres:

```bash
# Start Postgres
docker compose up -d postgres

# Wait a few seconds for Postgres to be ready
sleep 5
```

### If using system Postgres:

```bash
sudo -u postgres psql -c "CREATE USER clawtrader WITH PASSWORD 'clawtrader';"
sudo -u postgres psql -c "CREATE DATABASE clawtrader OWNER clawtrader;"
```

---

## 5. Environment configuration

```bash
cp .env.example .env
nano .env
```

Set at least:

```env
# Docker Postgres:
DATABASE_URL=postgresql://clawtrader:clawtrader@localhost:5432/clawtrader

# System Postgres (if you used different user/pass):
# DATABASE_URL=postgresql://clawtrader:clawtrader@localhost:5432/clawtrader

# Production domain (clawtrade.net):
BASE_URL=https://clawtrade.net
SITE_DOMAIN=clawtrade.net
CORS_ORIGIN=https://clawtrade.net
NEXT_PUBLIC_API_URL=https://clawtrade.net
NEXT_PUBLIC_SITE_URL=https://clawtrade.net
```

For local testing only, keep defaults: `BASE_URL=http://localhost:3001` and leave others commented.

---

## 6. Install dependencies and build

```bash
# Root project
npm install

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

---

## 7. Create database and run migrations

```bash
export DATABASE_URL=postgresql://clawtrader:clawtrader@localhost:5432/clawtrader
npm run db:create
npm run db:migrate
```

If using system Postgres with different credentials, adjust `DATABASE_URL`.

---

## 8. Build the app

```bash
npm run build
```

---

## 9. Run with PM2 (production)

```bash
# Install PM2
sudo npm install -g pm2

# Start backend (port 3001)
cd backend && pm2 start src/index.js --name clawtrade-api && cd ..

# Start frontend (port 3000)
cd frontend && pm2 start npm --name clawtrade-web -- start && cd ..

# Save process list and enable startup
pm2 save
pm2 startup
# Run the command that pm2 startup prints (sudo env PATH=...)
```

Check status:

```bash
pm2 status
```

---

## 10. Reverse proxy (Nginx) for clawtrade.net

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create Nginx config:

```bash
sudo nano /etc/nginx/sites-available/clawtrade
```

Paste:

```nginx
server {
    listen 80;
    server_name clawtrade.net;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /skill.md {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /heartbeat.md {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/clawtrade /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL (ensure clawtrade.net points to this server’s IP first)
sudo certbot --nginx -d clawtrade.net
```

---

## 11. Verify

- Frontend: https://clawtrade.net
- API health: https://clawtrade.net/api/v1 (via frontend rewrites) or `curl http://localhost:3001/health`
- skill.md: https://clawtrade.net/skill.md
- heartbeat.md: https://clawtrade.net/heartbeat.md

---

## 12. Update with new code

After pushing changes to the repo, update the server:

```bash
cd /opt/clawtrade
git pull
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
npm run build
pm2 restart clawtrade-api clawtrade-web
```

**Shortcut (no dependency changes):**

```bash
cd /opt/clawtrade && git pull && npm run build && pm2 restart clawtrade-api clawtrade-web
```

**Database migrations** (if new migrations exist):

```bash
cd /opt/clawtrade
export DATABASE_URL=postgresql://clawtrader:clawtrader@localhost:5432/clawtrader
npm run db:migrate
```

---

## Quick reference

| Service      | Port | URL (local)              |
|-------------|------|--------------------------|
| Frontend    | 3000 | http://localhost:3000    |
| Backend API | 3001 | http://localhost:3001    |
| PostgreSQL  | 5432 | localhost:5432           |

**PM2 commands:**
```bash
pm2 status          # List processes
pm2 logs            # View logs
pm2 restart all     # Restart everything
```
