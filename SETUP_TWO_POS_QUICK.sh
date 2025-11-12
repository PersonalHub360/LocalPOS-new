#!/bin/bash
# Quick setup script for two POS instances
# Run this on the server after uploading deployment packages

set -e

echo "===== Setting up BFC and Bond Coffee POS Instances ====="

# Step 1: Create directories and databases
echo "Step 1: Creating directories and databases..."
sudo mkdir -p /var/www/bfcpos /var/log/bfcpos /var/backups/bfcpos
sudo mkdir -p /var/www/bondcoffeepos /var/log/bondcoffeepos /var/backups/bondcoffeepos

sudo chown -R nodejs:nodejs /var/www/bfcpos /var/log/bfcpos /var/backups/bfcpos
sudo chown -R nodejs:nodejs /var/www/bondcoffeepos /var/log/bondcoffeepos /var/backups/bondcoffeepos

# Create databases
sudo -u postgres psql <<EOF
-- Create databases
CREATE DATABASE bfcpos_db;
CREATE DATABASE bondcoffeepos_db;

-- Create users with passwords
CREATE USER bfcpos_user WITH PASSWORD 'BfcPOS2024!Secure';
CREATE USER bondcoffeepos_user WITH PASSWORD 'BondCoffeePOS2024!Secure';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE bfcpos_db TO bfcpos_user;
GRANT ALL PRIVILEGES ON DATABASE bondcoffeepos_db TO bondcoffeepos_user;

-- Connect to each database and grant schema privileges
\c bfcpos_db
GRANT ALL ON SCHEMA public TO bfcpos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bfcpos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bfcpos_user;

\c bondcoffeepos_db
GRANT ALL ON SCHEMA public TO bondcoffeepos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bondcoffeepos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bondcoffeepos_user;

\q
EOF

# Create .env.production files
echo "Step 2: Creating .env.production files..."
SESSION_SECRET_BFC=$(openssl rand -base64 32)
SESSION_SECRET_BONDCOFFEE=$(openssl rand -base64 32)

sudo tee /var/www/bfcpos/.env.production > /dev/null <<EOF
DATABASE_URL=postgresql://bfcpos_user:BfcPOS2024!Secure@localhost:5432/bfcpos_db
SESSION_SECRET=$SESSION_SECRET_BFC
PORT=7000
NODE_ENV=production
EOF

sudo tee /var/www/bondcoffeepos/.env.production > /dev/null <<EOF
DATABASE_URL=postgresql://bondcoffeepos_user:BondCoffeePOS2024!Secure@localhost:5432/bondcoffeepos_db
SESSION_SECRET=$SESSION_SECRET_BONDCOFFEE
PORT=8000
NODE_ENV=production
EOF

sudo chown nodejs:nodejs /var/www/bfcpos/.env.production /var/www/bondcoffeepos/.env.production
sudo chmod 600 /var/www/bfcpos/.env.production /var/www/bondcoffeepos/.env.production

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

# Step 4: Deploy Bond Coffee POS
echo "Step 4: Deploying Bond Coffee POS..."
cd /var/www/bondcoffeepos
sudo tar -xzf /tmp/bondcoffeepos-deploy.tar.gz -C /var/www/bondcoffeepos --overwrite
sudo chown -R nodejs:nodejs /var/www/bondcoffeepos
sudo mv /var/www/bondcoffeepos/deploy-bondcoffee.sh /var/www/bondcoffeepos/deploy.sh 2>/dev/null || true
sudo mv /var/www/bondcoffeepos/start-bondcoffee.sh /var/www/bondcoffeepos/start.sh 2>/dev/null || true
sudo mv /var/www/bondcoffeepos/ecosystem-bondcoffee.config.cjs /var/www/bondcoffeepos/ecosystem.config.cjs 2>/dev/null || true
sudo chmod +x /var/www/bondcoffeepos/deploy.sh /var/www/bondcoffeepos/start.sh
sudo bash /var/www/bondcoffeepos/deploy.sh

# Step 5: Setup Nginx
echo "Step 5: Setting up Nginx..."
sudo cp /var/www/bfcpos/nginx-bfc.conf /etc/nginx/sites-available/bfc.bfcpos.com
sudo cp /var/www/bondcoffeepos/nginx-bondcoffee.conf /etc/nginx/sites-available/bondcoffee.bfcpos.com

sudo ln -sf /etc/nginx/sites-available/bfc.bfcpos.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/bondcoffee.bfcpos.com /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx

echo "✓ Nginx configured!"

# Step 6: Setup SSL (requires DNS to be configured first)
echo "Step 6: Setting up SSL certificates..."
echo "⚠️  Make sure DNS is configured for bfc.bfcpos.com and bondcoffee.bfcpos.com before running:"
echo "   sudo certbot --nginx -d bfc.bfcpos.com -d www.bfc.bfcpos.com"
echo "   sudo certbot --nginx -d bondcoffee.bfcpos.com -d www.bondcoffee.bfcpos.com"

echo ""
echo "===== Setup Complete! ====="
echo "BFC POS: http://localhost:7000"
echo "Bond Coffee POS: http://localhost:8000"
echo ""
echo "Next steps:"
echo "1. Configure DNS for bfc.bfcpos.com and bondcoffee.bfcpos.com"
echo "2. Run certbot commands above to get SSL certificates"
echo "3. Verify services: sudo systemctl status bfcpos bondcoffeepos"

