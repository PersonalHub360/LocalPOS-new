#!/bin/bash
# Deployment script for Adora POS
# Run this on the server after uploading the deployment package

set -e

echo "===== Deploying Adora POS System ====="

# Navigate to Adora POS directory
cd /var/www/adorapos

# Extract deployment package
echo "Extracting deployment package..."
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite

# Rename ecosystem config file
sudo mv /var/www/adorapos/ecosystem-adora.config.cjs /var/www/adorapos/ecosystem.config.cjs 2>/dev/null || true

# Rename start script
sudo mv /var/www/adorapos/start-adora.sh /var/www/adorapos/start.sh 2>/dev/null || true

# Fix PM2 path in start.sh if needed
sudo sed -i 's|/home/nodejs/node_modules/.bin/pm2-runtime|/usr/bin/pm2-runtime|g' /var/www/adorapos/start.sh 2>/dev/null || true
sudo chmod +x /var/www/adorapos/start.sh 2>/dev/null || true

# Set ownership
sudo chown -R nodejs:nodejs /var/www/adorapos

# Install dependencies
echo "Installing dependencies..."
sudo -u nodejs bash -c "cd /var/www/adorapos && npm install --production --no-audit --no-fund" || sudo -u nodejs bash -c "cd /var/www/adorapos && npm ci --production --no-audit --no-fund"

# Restart service
echo "Restarting Adora POS service..."
sudo systemctl restart adorapos

# Wait for service to start
sleep 5

# Verify service is running
echo "Verifying service status..."
sudo systemctl status adorapos --no-pager

# Test health endpoint
echo "Testing health endpoint..."
curl http://localhost:9000/health || echo "Health check failed - check logs"

echo "===== Adora POS deployment complete ====="

