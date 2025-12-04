#!/bin/bash
# Initial setup script for Adora POS instance
# Run this on the server BEFORE deploying the application

set -e

echo "===== Setting up Adora POS Instance ====="

# Step 1: Create directories
echo "Step 1: Creating directories..."
sudo mkdir -p /var/www/adorapos /var/log/adorapos /var/backups/adorapos
sudo chown -R nodejs:nodejs /var/www/adorapos /var/log/adorapos /var/backups/adorapos

# Step 2: Create database
echo "Step 2: Creating database..."
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE adorapos_db;

-- Create user with password
CREATE USER adorapos_user WITH PASSWORD 'AdoraPOS2024!Secure';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE adorapos_db TO adorapos_user;

-- Connect to database and grant schema privileges
\c adorapos_db
GRANT ALL ON SCHEMA public TO adorapos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO adorapos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO adorapos_user;

\q
EOF

# Step 3: Create .env.production file
echo "Step 3: Creating .env.production file..."
SESSION_SECRET_ADORA=$(openssl rand -base64 32)

sudo tee /var/www/adorapos/.env.production > /dev/null <<EOF
# Adora POS System - Production Environment Variables
DATABASE_URL=postgresql://adorapos_user:AdoraPOS2024!Secure@localhost:5432/adorapos_db
SESSION_SECRET=$SESSION_SECRET_ADORA
PORT=9000
NODE_ENV=production
EOF

# Set correct ownership and permissions
sudo chown nodejs:nodejs /var/www/adorapos/.env.production
sudo chmod 600 /var/www/adorapos/.env.production

# Step 4: Install systemd service
echo "Step 4: Installing systemd service..."
sudo cp /var/www/adorapos/adorapos.service /etc/systemd/system/adorapos.service
sudo systemctl daemon-reload
sudo systemctl enable adorapos

# Step 5: Setup Nginx configuration
echo "Step 5: Setting up Nginx configuration..."
sudo cp /var/www/adorapos/nginx-adora.conf /etc/nginx/sites-available/adora-pos.conf
sudo ln -sf /etc/nginx/sites-available/adora-pos.conf /etc/nginx/sites-enabled/adora-pos.conf
sudo nginx -t
sudo systemctl reload nginx

echo "===== Adora POS setup complete ====="
echo ""
echo "Next steps:"
echo "1. Deploy the application files"
echo "2. Run migrations: cd /var/www/adorapos && sudo -u nodejs bash -c 'source .env.production && npm run db:migrate'"
echo "3. Start the service: sudo systemctl start adorapos"
echo "4. Configure SSL: sudo certbot --nginx -d adora.bfcpos.com -d www.adora.bfcpos.com"

