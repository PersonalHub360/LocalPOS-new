# Deploy POS Instances with Pre-built Dist

This guide shows how to build the application locally and deploy with the `dist` folder included, so the server doesn't need to build it.

## Quick Steps

### 1. Build and Package Locally

From the `LocalPOS-new` directory, run:

```bash
# Option A: Use the automated script
chmod +x BUILD_AND_PACKAGE.sh
./BUILD_AND_PACKAGE.sh

# Option B: Manual steps
npm ci
npm run build

# Create BFC package
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

# Create Adora package
tar -czf adorapos-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  client server shared migrations scripts dist \
  package.json package-lock.json \
  tsconfig.json vite.config.ts tailwind.config.ts \
  postcss.config.js drizzle.config.ts components.json \
  deploy-adora.sh start-adora.sh ecosystem-adora.config.cjs adorapos.service nginx-adora.conf
```

### 2. Upload to Server

```bash
scp -i "C:\Users\9RZGXQ3\Downloads\api-server-key.pem" bfcpos-deploy.tar.gz ubuntu@54.254.253.106:/tmp/
scp -i "C:\Users\9RZGXQ3\Downloads\api-server-key.pem" adorapos-deploy.tar.gz ubuntu@54.254.253.106:/tmp/
```

### 3. Deploy on Server

The deployment scripts will automatically detect that `dist` exists and skip the build step, installing only production dependencies.

```bash
# Follow the deployment steps from DEPLOY_TWO_POS_INSTANCES.md
# The deploy scripts will automatically:
# - Detect dist/public and dist/index.js exist
# - Install only production dependencies
# - Skip the build step
# - Run migrations
# - Start the services
```

## Benefits

- **Faster deployment**: No build time on server
- **Lower server resources**: Only production dependencies installed
- **Consistent builds**: Built in your local environment
- **Easier debugging**: Build issues caught locally before deployment

## Note

The deployment scripts (`deploy-bfc.sh` and `deploy-adora.sh`) already include logic to:
- Check if `dist/public` and `dist/index.js` exist
- Install only production dependencies if dist exists
- Skip the build step if dist exists
- Fall back to full build if dist is missing

So you can use the same deployment scripts whether you include dist or not!

