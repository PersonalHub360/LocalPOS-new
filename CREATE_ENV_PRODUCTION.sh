#!/bin/bash
# Script to create .env.production files for both POS instances on the server
# Run this on the server after creating databases

set -e

echo "Creating .env.production files for BFC and Adora POS..."

# Generate secure session secrets
SESSION_SECRET_BFC=$(openssl rand -base64 32)
SESSION_SECRET_ADORA=$(openssl rand -base64 32)

# Create BFC POS .env.production
sudo tee /var/www/bfcpos/.env.production > /dev/null <<EOF
# BFC POS System - Production Environment Variables
DATABASE_URL=postgresql://bfcpos_user:BfcPOS2024!Secure@localhost:5432/bfcpos_db
SESSION_SECRET=$SESSION_SECRET_BFC
PORT=7000
NODE_ENV=production
EOF

# Create Adora POS .env.production
sudo tee /var/www/adorapos/.env.production > /dev/null <<EOF
# Adora POS System - Production Environment Variables
DATABASE_URL=postgresql://adorapos_user:AdoraPOS2024!Secure@localhost:5432/adorapos_db
SESSION_SECRET=$SESSION_SECRET_ADORA
PORT=8000
NODE_ENV=production
EOF

# Set correct ownership and permissions
sudo chown nodejs:nodejs /var/www/bfcpos/.env.production /var/www/adorapos/.env.production
sudo chmod 600 /var/www/bfcpos/.env.production /var/www/adorapos/.env.production

echo "✓ .env.production files created successfully!"
echo ""
echo "BFC POS .env.production location: /var/www/bfcpos/.env.production"
echo "Adora POS .env.production location: /var/www/adorapos/.env.production"
echo ""
echo "⚠️  Remember to change the database passwords if you used different ones!"

