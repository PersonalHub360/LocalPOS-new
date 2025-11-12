#!/bin/bash
# Build and package both POS instances for deployment
# This script builds the application locally and creates deployment packages with dist included

set -e

echo "===== Building and Packaging POS Instances ====="

# Step 1: Build the application
echo "Step 1: Building application..."
npm ci
npm run build

# Verify build output
if [ ! -d "dist/public" ] || [ ! -f "dist/index.js" ]; then
    echo "ERROR: Build failed! dist/public or dist/index.js not found."
    exit 1
fi

echo "✓ Build completed successfully!"

# Step 2: Create deployment packages with dist included
echo "Step 2: Creating deployment packages..."

# Package for BFC POS
echo "Creating bfcpos-deploy.tar.gz..."
tar -czf bfcpos-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  client server shared migrations scripts dist \
  package.json package-lock.json \
  tsconfig.json vite.config.ts tailwind.config.ts \
  postcss.config.js drizzle.config.ts components.json \
  deploy-bfc.sh start-bfc.sh ecosystem-bfc.config.cjs bfcpos.service nginx-bfc.conf

# Package for Bond Coffee POS
echo "Creating bondcoffeepos-deploy.tar.gz..."
tar -czf bondcoffeepos-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  client server shared migrations scripts dist \
  package.json package-lock.json \
  tsconfig.json vite.config.ts tailwind.config.ts \
  postcss.config.js drizzle.config.ts components.json \
  deploy-bondcoffee.sh start-bondcoffee.sh ecosystem-bondcoffee.config.cjs bondcoffeepos.service nginx-bondcoffee.conf

echo "✓ Deployment packages created!"
echo ""
echo "Packages ready:"
echo "  - bfcpos-deploy.tar.gz"
echo "  - bondcoffeepos-deploy.tar.gz"
echo ""
echo "Next step: Upload to server"
echo "  scp -i \"C:\\Users\\9RZGXQ3\\Downloads\\api-server-key.pem\" bfcpos-deploy.tar.gz ubuntu@54.254.253.106:/tmp/"
echo "  scp -i \"C:\\Users\\9RZGXQ3\\Downloads\\api-server-key.pem\" bondcoffeepos-deploy.tar.gz ubuntu@54.254.253.106:/tmp/"

