#!/bin/bash
# Quick deployment script for Adora POS
# Run this on the server

set -e

echo "===== Adora POS Deployment ====="

# Check if file exists
if [ ! -f /tmp/adorapos-deploy.tar.gz ]; then
    echo "❌ File /tmp/adorapos-deploy.tar.gz not found!"
    echo "Please upload the file first using:"
    echo "scp -i \"key.pem\" adorapos-deploy.tar.gz ubuntu@SERVER_IP:/tmp/"
    exit 1
fi

echo "✓ Package found"

# Create directory
echo "Creating directory..."
sudo mkdir -p /var/www/adorapos
sudo chown -R nodejs:nodejs /var/www/adorapos

# Extract package
echo "Extracting package..."
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite

# Check if setup script exists
if [ ! -f /var/www/adorapos/SETUP_ADORA_POS.sh ]; then
    echo "❌ SETUP_ADORA_POS.sh not found in package!"
    echo "Listing extracted files:"
    ls -la /var/www/adorapos/ | head -20
    exit 1
fi

# Run setup script
echo "Running setup script..."
sudo chmod +x /var/www/adorapos/SETUP_ADORA_POS.sh
sudo /var/www/adorapos/SETUP_ADORA_POS.sh

echo "===== Setup Complete ====="
echo ""
echo "Next steps:"
echo "1. Deploy application: cd /var/www/adorapos && sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite"
echo "2. Rename files and install: See deployment guide"
echo "3. Run migrations: sudo -u nodejs bash -c 'cd /var/www/adorapos && source .env.production && npm run db:migrate'"
echo "4. Start service: sudo systemctl start adorapos"

