# NAFES Healthcare Management System
## Setup and Deployment Guide

**Version:** 1.0  
**Date:** December 2024  
**Author:** NAFES Development Team

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Database Setup](#3-database-setup)
4. [Backend Setup](#4-backend-setup)
5. [Frontend Setup](#5-frontend-setup)
6. [AI/Ollama Setup (Optional)](#6-aiollama-setup-optional)
7. [NPHIES Configuration](#7-nphies-configuration)
8. [Production Deployment](#8-production-deployment)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

### Required Software

| Software | Minimum Version | Recommended | Download |
|----------|-----------------|-------------|----------|
| Node.js | 18.0 | 20.x LTS | https://nodejs.org |
| PostgreSQL | 14.0 | 15.x | https://www.postgresql.org |
| npm | 9.0 | 10.x | Included with Node.js |
| Git | 2.30 | Latest | https://git-scm.com |

### Optional Software

| Software | Version | Purpose | Download |
|----------|---------|---------|----------|
| Ollama | 0.1.x | AI/LLM features | https://ollama.ai |
| Docker | 24.x | Containerization | https://docker.com |
| PM2 | 5.x | Process management | npm install -g pm2 |

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 10 GB | 50+ GB |
| OS | Windows 10, Ubuntu 20.04, macOS 12 | Latest stable |

---

## 2. Quick Start

### Clone the Repository

```bash
git clone <repository-url>
cd final_nafes
```

### One-Command Setup (Development)

**Windows (PowerShell):**
```powershell
# Start PostgreSQL service (if not running)
net start postgresql-x64-15

# Setup and start backend
cd backend
npm install
# Create .env file (see section 4.2)
npm run dev

# In another terminal - Setup and start frontend
cd frontend
npm install
npm run dev
```

**Linux/macOS:**
```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Setup and start backend
cd backend
npm install
# Create .env file (see section 4.2)
npm run dev &

# Setup and start frontend
cd frontend
npm install
npm run dev
```

### Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8001
- **API Health Check:** http://localhost:8001/api/health

---

## 3. Database Setup

### 3.1 Create Database

**Using psql:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE nafes_healthcare;

# Connect to the new database
\c nafes_healthcare

# Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";  -- For AI features

# Exit
\q
```

**Using pgAdmin:**
1. Right-click on "Databases"
2. Select "Create" → "Database"
3. Name: `nafes_healthcare`
4. Owner: `postgres`
5. Click "Save"

### 3.2 Run Schema Migration

```bash
cd backend

# Run the main schema file
psql -U postgres -d nafes_healthcare -f migrations/schema.sql

# Run additional migrations (if any)
for file in migrations/*.sql; do
  psql -U postgres -d nafes_healthcare -f "$file"
done
```

### 3.3 Seed Initial Data (Optional)

```bash
cd backend

# Seed NPHIES codes
node scripts/seedNphiesCodes.js

# Seed medical knowledge for AI
node scripts/seedMedicalKnowledge.js

# Import medicines database
node scripts/importMedicines.js
```

### 3.4 Verify Database Setup

```bash
psql -U postgres -d nafes_healthcare -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

Expected output: 34 tables listed.

---

## 4. Backend Setup

### 4.1 Install Dependencies

```bash
cd backend
npm install
```

### 4.2 Environment Configuration

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=8001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nafes_healthcare
DB_USER=postgres
DB_PASSWORD=your_password_here

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# NPHIES Configuration (Production)
NPHIES_BASE_URL=https://hsb.nphies.sa
NPHIES_PROVIDER_ID=your_provider_id
NPHIES_API_KEY=your_api_key
NPHIES_CERTIFICATE_PATH=./certs/nphies.pem

# AI/Ollama Configuration (Optional)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=cniongolo/biomistral
OLLAMA_TIMEOUT=120000
ENABLE_AI_FEATURES=true

# Security
JWT_SECRET=your_jwt_secret_here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4.3 Start Backend Server

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

### 4.4 Verify Backend

```bash
# Check health endpoint
curl http://localhost:8001/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-12-06T...","database":"connected"}
```

---

## 5. Frontend Setup

### 5.1 Install Dependencies

```bash
cd frontend
npm install
```

### 5.2 Environment Configuration

Create a `.env` file in the `frontend` directory:

```env
# API Configuration
VITE_API_URL=http://localhost:8001/api

# Application Settings
VITE_APP_NAME=NAFES Healthcare
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_AI_CHAT=true
VITE_ENABLE_MEDICATION_SAFETY=true
```

### 5.3 Start Frontend Server

**Development Mode:**
```bash
npm run dev
```

**Build for Production:**
```bash
npm run build
```

**Preview Production Build:**
```bash
npm run preview
```

### 5.4 Verify Frontend

Open http://localhost:5173 in your browser. You should see the NAFES dashboard.

---

## 6. AI/Ollama Setup (Optional)

### 6.1 Install Ollama

**Windows:**
```powershell
# Download and install from https://ollama.ai
winget install Ollama.Ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS:**
```bash
brew install ollama
```

### 6.2 Start Ollama Service

```bash
ollama serve
```

### 6.3 Pull BioMistral Model

```bash
ollama pull cniongolo/biomistral
```

### 6.4 Verify Ollama

```bash
curl http://localhost:11434/api/tags

# Or test generation
curl http://localhost:11434/api/generate -d '{
  "model": "cniongolo/biomistral",
  "prompt": "What is diabetes?",
  "stream": false
}'
```

### 6.5 Seed Medical Knowledge

```bash
cd backend
node scripts/seedMedicalKnowledge.js
```

---

## 7. NPHIES Configuration

### 7.1 Prerequisites

- Valid NPHIES provider registration
- Provider ID from NPHIES
- API credentials (certificate/key)
- Registered facility in NPHIES

### 7.2 Certificate Setup

```bash
# Create certificates directory
mkdir -p backend/certs

# Copy your NPHIES certificate
cp /path/to/your/nphies-certificate.pem backend/certs/nphies.pem
cp /path/to/your/nphies-key.pem backend/certs/nphies-key.pem

# Set proper permissions (Linux/macOS)
chmod 600 backend/certs/*.pem
```

### 7.3 Environment Variables

Update your `.env` file:

```env
# NPHIES Production
NPHIES_BASE_URL=https://hsb.nphies.sa
NPHIES_PROVIDER_ID=INS-XXXXX
NPHIES_FACILITY_ID=FAC-XXXXX
NPHIES_CERTIFICATE_PATH=./certs/nphies.pem
NPHIES_KEY_PATH=./certs/nphies-key.pem

# NPHIES Sandbox (for testing)
# NPHIES_BASE_URL=https://hsb-sandbox.nphies.sa
```

### 7.4 Test NPHIES Connection

```bash
# Run NPHIES connection test
node scripts/testNphiesConnection.js
```

---

## 8. Production Deployment

### 8.1 Using PM2 (Recommended)

**Install PM2:**
```bash
npm install -g pm2
```

**Create ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'nafes-backend',
      script: 'server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8001
      }
    }
  ]
};
```

**Start with PM2:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8.2 Frontend Deployment

**Build:**
```bash
cd frontend
npm run build
```

**Serve with Nginx:**
```nginx
server {
    listen 80;
    server_name nafes.example.com;
    root /var/www/nafes/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 8.3 Using Docker

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: nafes_healthcare
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=nafes_healthcare
      - DB_USER=postgres
      - DB_PASSWORD=${DB_PASSWORD}
    ports:
      - "8001:8001"
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

volumes:
  postgres_data:
  ollama_data:
```

**Run with Docker Compose:**
```bash
docker-compose up -d
```

### 8.4 SSL/TLS Configuration

**Using Certbot (Let's Encrypt):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d nafes.example.com
```

---

## 9. Troubleshooting

### 9.1 Common Issues

#### Database Connection Failed

**Error:** `ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```bash
# Check PostgreSQL service
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql

# Verify connection
psql -U postgres -h localhost
```

#### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::8001`

**Solution:**
```bash
# Find process using port
netstat -ano | findstr :8001  # Windows
lsof -i :8001                  # Linux/macOS

# Kill process
taskkill /PID <pid> /F         # Windows
kill -9 <pid>                  # Linux/macOS
```

#### CORS Errors

**Error:** `Access-Control-Allow-Origin` header missing

**Solution:**
1. Check `CORS_ORIGIN` in backend `.env`
2. Ensure frontend URL is in the allowed origins
3. Restart backend server

#### Ollama Connection Failed

**Error:** `connect ECONNREFUSED 127.0.0.1:11434`

**Solution:**
```bash
# Check if Ollama is running
ollama list

# Start Ollama service
ollama serve

# Verify model is downloaded
ollama pull cniongolo/biomistral
```

### 9.2 Logs and Debugging

**Backend Logs:**
```bash
# Development
npm run dev 2>&1 | tee backend.log

# PM2
pm2 logs nafes-backend
```

**Database Logs:**
```bash
# PostgreSQL logs (Linux)
tail -f /var/log/postgresql/postgresql-15-main.log
```

**Frontend Build Errors:**
```bash
# Clear cache and rebuild
rm -rf node_modules/.vite
npm run build -- --debug
```

### 9.3 Reset Development Environment

```bash
# Stop all services
pm2 stop all

# Reset database
psql -U postgres -c "DROP DATABASE IF EXISTS nafes_healthcare;"
psql -U postgres -c "CREATE DATABASE nafes_healthcare;"
psql -U postgres -d nafes_healthcare -f backend/migrations/schema.sql

# Clear node modules
rm -rf backend/node_modules frontend/node_modules

# Reinstall
cd backend && npm install
cd ../frontend && npm install

# Restart
npm run dev
```

### 9.4 Performance Issues

**Slow Database Queries:**
```sql
-- Check slow queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Analyze tables
ANALYZE;
```

**High Memory Usage:**
```bash
# Check Node.js memory
node --max-old-space-size=4096 server.js

# PM2 memory limit
pm2 start server.js --max-memory-restart 1G
```

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Start Backend (dev) | `cd backend && npm run dev` |
| Start Frontend (dev) | `cd frontend && npm run dev` |
| Build Frontend | `cd frontend && npm run build` |
| Run Migrations | `psql -U postgres -d nafes_healthcare -f migrations/schema.sql` |
| Start Ollama | `ollama serve` |
| Check API Health | `curl http://localhost:8001/api/health` |
| PM2 Status | `pm2 status` |
| PM2 Logs | `pm2 logs` |
| PM2 Restart | `pm2 restart all` |

---

## Support

For additional support:
- Check the project documentation
- Review the Technical Specification document
- Contact the development team

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | NAFES Team | Initial document |

---

*This document provides setup and deployment instructions for the NAFES Healthcare Management System.*

