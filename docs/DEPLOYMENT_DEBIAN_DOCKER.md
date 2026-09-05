# Tâm An Care - Debian & Docker Deployment Guide

This guide provides step-by-step instructions to clone, configure, and run **Tâm An Care V7.5** on a **Debian Linux** machine (Debian 11 / 12) using **Docker** and **Docker Compose**.

---

## 📋 System Requirements

* **Operating System:** Debian 11 (Bullseye) or Debian 12 (Bookworm) 64-bit
* **CPU:** 2 vCPUs minimum
* **RAM:** 2 GB minimum (4 GB recommended for production)
* **Disk Space:** 15 GB available SSD storage
* **Network:** Open inbound ports `80` (HTTP), `443` (HTTPS), and optionally `3000` (API testing)

---

## 🛠️ Step 1: Install Docker & Dependencies on Debian

Log into your Debian server via SSH and follow these commands:

### 1. Update APT Packages & Install Prerequisites
```bash
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    git \
    lsb-release
```

### 2. Add Docker's Official GPG Key & Repository
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
```

### 3. Install Docker Engine & Docker Compose Plugin
```bash
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 4. Enable and Manage Docker Permissions
```bash
# Enable Docker service on boot
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group (run docker without sudo)
sudo usermod -aG docker $USER

# Apply new group membership (or log out and log back in)
newgrp docker
```

Verify installation:
```bash
docker --version
docker compose version
```

---

## 🐙 Step 2: Clone the Project from GitHub

Clone your GitHub repository to the server:

```bash
# Navigate to your deployment directory (e.g. /var/www or home directory)
cd ~

# Clone the repository
git clone https://github.com/<YOUR_USERNAME>/tam-an-care.git

# Enter the project directory
cd tam-an-care/TamAnCare_V7_4_3_Development
```

---

## 🚀 Step 3: Run the Application with Docker Compose

You can deploy the application using either **Quick/Development Mode** or **Production Mode**.

---

### Option A: Quick Start Deployment (Development / Staging)

This mode runs PostgreSQL 16 and the API service with automatic schema initialization (`database/schema.sql`).

#### 1. Launch Containers
```bash
docker compose up -d --build
```

#### 2. Check Running Services
```bash
docker compose ps
```
You should see output similar to:
```
NAME                           COMMAND                  SERVICE      STATUS      PORTS
tamancare-api-1                "docker-entrypoint.s…"   api          running     0.0.0.0:3000->3000/tcp
tamancare-postgres-1           "docker-entrypoint.s…"   postgres     running     5432/tcp
```

#### 3. Verify Health
```bash
curl http://localhost:3000/api/health/ready
```

---

### Option B: Enterprise Production Deployment

For production deployments, use the hardened configuration located in `deploy/production/docker-compose.production.yml`.

#### 1. Setup Production Secrets
Create the secrets folder and credentials:
```bash
mkdir -p deploy/production/secrets

# Generate strong secrets
echo "YOUR_STRONG_POSTGRES_PASSWORD" > deploy/production/secrets/postgres_password
echo "postgresql://taman:YOUR_STRONG_POSTGRES_PASSWORD@postgres:5432/taman_care" > deploy/production/secrets/database_url
echo "YOUR_JWT_SECRET_KEY_MINIMUM_32_CHARACTERS_LONG" > deploy/production/secrets/jwt_secret

# Secure secret permissions
chmod 600 deploy/production/secrets/*
```

#### 2. Configure Environment Variables
Create `.env` inside `deploy/production/`:
```bash
cat << 'EOF' > deploy/production/.env
POSTGRES_DB=taman_care
POSTGRES_USER=taman
CORS_ORIGIN=https://yourdomain.com
TAMANCARE_SERVER_NAME=yourdomain.com
TAMANCARE_WEB_DIST=/var/www/tamancare/frontend/dist
TAMANCARE_TLS_DIR=/etc/ssl/tamancare
TAMANCARE_ACME_DIR=/var/www/certbot
EOF
```

#### 3. Build Frontend Assets
If Node.js is installed locally on the host:
```bash
cd frontend
npm install
npm run build
cd ..
```

#### 4. Launch Production Stack
```bash
docker compose -f deploy/production/docker-compose.production.yml --env-file deploy/production/.env up -d --build
```

---

## 🔍 Step 4: Maintenance & Operation Commands

### Viewing Logs
```bash
# View all container logs
docker compose logs -f

# View API container logs only
docker compose logs -f api

# View Postgres logs
docker compose logs -f postgres
```

### Stopping Services
```bash
# Stop containers
docker compose stop

# Stop and remove containers and networks
docker compose down
```

### Updating to Latest Code from GitHub
```bash
# Pull latest commits
git pull origin main

# Rebuild and restart updated containers
docker compose up -d --build
```

### Database Backup & Restore
```bash
# Create PostgreSQL Backup
docker compose exec postgres pg_dump -U taman taman_care > backup_$(date +%Y%m%m_%H%M%S).sql

# Restore PostgreSQL Backup
cat backup.sql | docker compose exec -T postgres psql -U taman -d taman_care
```

---

## 🛡️ Firewall Configuration (Debian UFW)

If UFW is enabled on Debian, allow HTTP/HTTPS traffic:

```bash
sudo apt-get install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp   # Optional: API direct access
sudo ufw enable
```
