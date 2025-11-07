# Deploy Two POS Instances (bfc.bfcpos.com and adora.bfcpos.com)

This guide will help you deploy two separate POS instances using the LocalPOS-new application on the same server.

## Overview

- **bfc.bfcpos.com** → Port 7000 → Database: `bfcpos_db` → User: `bfcpos_user`
- **adora.bfcpos.com** → Port 8000 → Database: `adorapos_db` → User: `adorapos_user`

## Step 1: Create Directories and Database Setup

Run these commands on the server:

```bash
# 1. Create application directories
sudo mkdir -p /var/www/bfcpos /var/log/bfcpos /var/backups/bfcpos
sudo mkdir -p /var/www/adorapos /var/log/adorapos /var/backups/adorapos

# 2. Set ownership
sudo chown -R nodejs:nodejs /var/www/bfcpos /var/log/bfcpos /var/backups/bfcpos
sudo chown -R nodejs:nodejs /var/www/adorapos /var/log/adorapos /var/backups/adorapos

# 3. Create PostgreSQL databases and users
sudo -u postgres psql <<EOF
-- Create databases
CREATE DATABASE bfcpos_db;
CREATE DATABASE adorapos_db;

-- Create users with passwords
CREATE USER bfcpos_user WITH PASSWORD 'BfcPOS2024!Secure';
CREATE USER adorapos_user WITH PASSWORD 'AdoraPOS2024!Secure';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE bfcpos_db TO bfcpos_user;
GRANT ALL PRIVILEGES ON DATABASE adorapos_db TO adorapos_user;

-- Connect to each database and grant schema privileges
\c bfcpos_db
GRANT ALL ON SCHEMA public TO bfcpos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bfcpos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bfcpos_user;

\c adorapos_db
GRANT ALL ON SCHEMA public TO adorapos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO adorapos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO adorapos_user;

\q
EOF

# 4. Create .env.production files
SESSION_SECRET_BFC=$(openssl rand -base64 32)
SESSION_SECRET_ADORA=$(openssl rand -base64 32)

sudo tee /var/www/bfcpos/.env.production > /dev/null <<EOF
DATABASE_URL=postgresql://bfcpos_user:BfcPOS2024!Secure@localhost:5432/bfcpos_db
SESSION_SECRET=$SESSION_SECRET_BFC
PORT=7000
NODE_ENV=production
EOF

sudo tee /var/www/adorapos/.env.production > /dev/null <<EOF
DATABASE_URL=postgresql://adorapos_user:AdoraPOS2024!Secure@localhost:5432/adorapos_db
SESSION_SECRET=$SESSION_SECRET_ADORA
PORT=8000
NODE_ENV=production
EOF

# Set permissions
sudo chown nodejs:nodejs /var/www/bfcpos/.env.production /var/www/adorapos/.env.production
sudo chmod 600 /var/www/bfcpos/.env.production /var/www/adorapos/.env.production

echo "✓ Directories and databases created!"
```

## Step 2: Prepare Deployment Files Locally

On your local machine, create deployment packages:

```bash
# From LocalPOS-new directory
cd LocalPOS-new

# Create deployment package for BFC
tar -czf bfcpos-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='dist' \
  --exclude='*.log' \
  client server shared migrations scripts \
  package.json package-lock.json \
  tsconfig.json vite.config.ts tailwind.config.ts \
  postcss.config.js drizzle.config.ts components.json \
  deploy-bfc.sh start-bfc.sh ecosystem-bfc.config.cjs bfcpos.service nginx-bfc.conf

# Create deployment package for Adora
tar -czf adorapos-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='dist' \
  --exclude='*.log' \
  client server shared migrations scripts \
  package.json package-lock.json \
  tsconfig.json vite.config.ts tailwind.config.ts \
  postcss.config.js drizzle.config.ts components.json \
  deploy-adora.sh start-adora.sh ecosystem-adora.config.cjs adorapos.service nginx-adora.conf

# Upload to server
scp -i "C:\Users\9RZGXQ3\Downloads\api-server-key.pem" bfcpos-deploy.tar.gz ubuntu@54.254.253.106:/tmp/
scp -i "C:\Users\9RZGXQ3\Downloads\api-server-key.pem" adorapos-deploy.tar.gz ubuntu@54.254.253.106:/tmp/
```

## Step 4: Deploy on Server

```bash
# Deploy BFC POS
cd /var/www/bfcpos
sudo tar -xzf /tmp/bfcpos-deploy.tar.gz -C /var/www/bfcpos --overwrite
sudo chown -R nodejs:nodejs /var/www/bfcpos
# Rename files to standard names
sudo mv /var/www/bfcpos/deploy-bfc.sh /var/www/bfcpos/deploy.sh
sudo mv /var/www/bfcpos/start-bfc.sh /var/www/bfcpos/start.sh
sudo mv /var/www/bfcpos/ecosystem-bfc.config.cjs /var/www/bfcpos/ecosystem.config.cjs
sudo chmod +x /var/www/bfcpos/deploy.sh /var/www/bfcpos/start.sh
sudo bash /var/www/bfcpos/deploy.sh

# Deploy Adora POS
cd /var/www/adorapos
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite
sudo chown -R nodejs:nodejs /var/www/adorapos
# Rename files to standard names
sudo mv /var/www/adorapos/deploy-adora.sh /var/www/adorapos/deploy.sh
sudo mv /var/www/adorapos/start-adora.sh /var/www/adorapos/start.sh
sudo mv /var/www/adorapos/ecosystem-adora.config.cjs /var/www/adorapos/ecosystem.config.cjs
sudo chmod +x /var/www/adorapos/deploy.sh /var/www/adorapos/start.sh
sudo bash /var/www/adorapos/deploy.sh
```

## Step 5: Setup Nginx

```bash
# Copy Nginx configs
sudo cp /var/www/bfcpos/nginx-bfc.conf /etc/nginx/sites-available/bfc.bfcpos.com
sudo cp /var/www/adorapos/nginx-adora.conf /etc/nginx/sites-available/adora.bfcpos.com

# Enable sites
sudo ln -sf /etc/nginx/sites-available/bfc.bfcpos.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/adora.bfcpos.com /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 6: Setup SSL Certificates

```bash
# Get SSL certificates for both subdomains
sudo certbot --nginx -d bfc.bfcpos.com -d www.bfc.bfcpos.com
sudo certbot --nginx -d adora.bfcpos.com -d www.adora.bfcpos.com

# Verify certificates
sudo certbot certificates
```

## Step 7: Verify Deployment

```bash
# Check services
sudo systemctl status bfcpos
sudo systemctl status adorapos

# Check health endpoints
curl http://localhost:7000/health
curl http://localhost:8000/health

# Check logs
sudo journalctl -u bfcpos -n 50 --no-pager
sudo journalctl -u adorapos -n 50 --no-pager
```

## Troubleshooting

### Check if ports are in use
```bash
sudo netstat -tlnp | grep -E ':(7000|8000)'
```

### Restart services
```bash
sudo systemctl restart bfcpos
sudo systemctl restart adorapos
```

### Check database connections
```bash
sudo -u postgres psql -d bfcpos_db -c "SELECT current_database(), current_user;"
sudo -u postgres psql -d adorapos_db -c "SELECT current_database(), current_user;"
```

