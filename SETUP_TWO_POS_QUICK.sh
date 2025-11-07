#!/bin/bash
# Quick setup script for two POS instances
# Run this on the server after uploading deployment packages

set -e

echo "===== Setting up BFC and Adora POS Instances ====="

# Step 1: Create directories and databases
echo "Step 1: Creating directories and databases..."
sudo mkdir -p /var/www/bfcpos /var/log/bfcpos /var/backups/bfcpos
sudo mkdir -p /var/www/adorapos /var/log/adorapos /var/backups/adorapos

sudo chown -R nodejs:nodejs /var/www/bfcpos /var/log/bfcpos /var/backups/bfcpos
sudo chown -R nodejs:nodejs /var/www/adorapos /var/log/adorapos /var/backups/adorapos

# Create databases
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

# Create .env.production files
echo "Step 2: Creating .env.production files..."
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

sudo chown nodejs:nodejs /var/www/bfcpos/.env.production /var/www/adorapos/.env.production
sudo chmod 600 /var/www/bfcpos/.env.production /var/www/adorapos/.env.production

echo "✓ Directories and databases created!"

# Step 3: Deploy BFC POS
echo "Step 3: Deploying BFC POS..."
cd /var/www/bfcpos
sudo tar -xzf /tmp/bfcpos-deploy.tar.gz -C /var/www/bfcpos --overwrite
sudo chown -R nodejs:nodejs /var/www/bfcpos
sudo mv /var/www/bfcpos/deploy-bfc.sh /var/www/bfcpos/deploy.sh 2>/dev/null || true
sudo mv /var/www/bfcpos/start-bfc.sh /var/www/bfcpos/start.sh 2>/dev/null || true
sudo mv /var/www/bfcpos/ecosystem-bfc.config.cjs /var/www/bfcpos/ecosystem.config.cjs 2>/dev/null || true
sudo chmod +x /var/www/bfcpos/deploy.sh /var/www/bfcpos/start.sh
sudo bash /var/www/bfcpos/deploy.sh

# Step 4: Deploy Adora POS
echo "Step 4: Deploying Adora POS..."
cd /var/www/adorapos
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite
sudo chown -R nodejs:nodejs /var/www/adorapos
sudo mv /var/www/adorapos/deploy-adora.sh /var/www/adorapos/deploy.sh 2>/dev/null || true
sudo mv /var/www/adorapos/start-adora.sh /var/www/adorapos/start.sh 2>/dev/null || true
sudo mv /var/www/adorapos/ecosystem-adora.config.cjs /var/www/adorapos/ecosystem.config.cjs 2>/dev/null || true
sudo chmod +x /var/www/adorapos/deploy.sh /var/www/adorapos/start.sh
sudo bash /var/www/adorapos/deploy.sh

# Step 5: Setup Nginx
echo "Step 5: Setting up Nginx..."
sudo cp /var/www/bfcpos/nginx-bfc.conf /etc/nginx/sites-available/bfc.bfcpos.com
sudo cp /var/www/adorapos/nginx-adora.conf /etc/nginx/sites-available/adora.bfcpos.com

sudo ln -sf /etc/nginx/sites-available/bfc.bfcpos.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/adora.bfcpos.com /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx

echo "✓ Nginx configured!"

# Step 6: Setup SSL (requires DNS to be configured first)
echo "Step 6: Setting up SSL certificates..."
echo "⚠️  Make sure DNS is configured for bfc.bfcpos.com and adora.bfcpos.com before running:"
echo "   sudo certbot --nginx -d bfc.bfcpos.com -d www.bfc.bfcpos.com"
echo "   sudo certbot --nginx -d adora.bfcpos.com -d www.adora.bfcpos.com"

echo ""
echo "===== Setup Complete! ====="
echo "BFC POS: http://localhost:7000"
echo "Adora POS: http://localhost:8000"
echo ""
echo "Next steps:"
echo "1. Configure DNS for bfc.bfcpos.com and adora.bfcpos.com"
echo "2. Run certbot commands above to get SSL certificates"
echo "3. Verify services: sudo systemctl status bfcpos adorapos"

