#!/bin/bash
set -e

# Deployment script for Bond Coffee POS System
# This script is executed on the EC2 instance via SSH from GitHub Actions

echo "====== Starting Deployment ======"
echo "Timestamp: $(date)"

# Configuration
APP_DIR="/var/www/bondcoffeepos"
DEPLOY_USER="nodejs"
BACKUP_DIR="/var/backups/bondcoffeepos"
SERVICE_NAME="bondcoffeepos"
PORT=8000

# Create backup directory if it doesn't exist
sudo mkdir -p "$BACKUP_DIR"

# Stop the application
echo "Stopping application..."
sudo systemctl stop $SERVICE_NAME || true

# Create backup of current version
if [ -d "$APP_DIR" ] && [ "$(ls -A $APP_DIR)" ]; then
    BACKUP_FILE="$BACKUP_DIR/bondcoffeepos-$(date +%Y%m%d-%H%M%S).tar.gz"
    echo "Creating backup: $BACKUP_FILE"
    sudo tar -czf "$BACKUP_FILE" -C "$APP_DIR" . || true
    
    # Keep only last 5 backups
    sudo find "$BACKUP_DIR" -name "bondcoffeepos-*.tar.gz" -type f | sort -r | tail -n +6 | xargs -r sudo rm -f
fi

# Extract new version
echo "Extracting new version..."
sudo mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Preserve start.sh if it exists (it's not in the deployment package)
if [ -f "$APP_DIR/start.sh" ]; then
    sudo cp "$APP_DIR/start.sh" /tmp/start-bondcoffee.sh.backup
fi

sudo tar -xzf /tmp/bondcoffeepos-deploy.tar.gz --overwrite

# Restore start.sh if it was backed up
if [ -f "/tmp/start-bondcoffee.sh.backup" ]; then
    sudo mv /tmp/start-bondcoffee.sh.backup "$APP_DIR/start.sh"
    sudo chmod +x "$APP_DIR/start.sh"
fi

# Rename ecosystem config if needed
if [ -f "$APP_DIR/ecosystem-bondcoffee.config.cjs" ] && [ ! -f "$APP_DIR/ecosystem.config.cjs" ]; then
    sudo mv "$APP_DIR/ecosystem-bondcoffee.config.cjs" "$APP_DIR/ecosystem.config.cjs"
fi

# Set correct permissions
sudo chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR"

# Ensure uploads directory exists
sudo mkdir -p "$APP_DIR/uploads"
sudo chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR/uploads"

# Copy and enable systemd service file
echo "Updating systemd service..."
sudo cp "$APP_DIR/bondcoffeepos.service" /etc/systemd/system/bondcoffeepos.service
sudo systemctl daemon-reload

# Install dependencies - only production if dist exists, otherwise full install for build
echo "Installing dependencies..."
if [ -d "$APP_DIR/dist/public" ] && [ -f "$APP_DIR/dist/index.js" ]; then
    echo "✓ Build artifacts already exist, installing production dependencies only..."
    sudo -u $DEPLOY_USER bash -c "cd $APP_DIR && npm install --production --no-audit --no-fund --prefer-offline" || \
    sudo -u $DEPLOY_USER bash -c "cd $APP_DIR && npm install --production --no-audit --no-fund"
else
    echo "Build artifacts missing, installing all dependencies (including devDependencies)..."
    sudo -u $DEPLOY_USER bash -c "cd $APP_DIR && npm ci --no-audit --no-fund"
fi

# Build application
echo "Building application..."
if [ -d "$APP_DIR/dist/public" ] && [ "$(ls -A $APP_DIR/dist/public 2>/dev/null)" ]; then
    echo "✓ Build artifacts already exist (dist/public found), skipping build..."
elif [ -f "$APP_DIR/dist/index.js" ]; then
    echo "⚠️  Server build exists but client build missing. Building client only..."
    sudo -u $DEPLOY_USER bash -c "cd $APP_DIR && npx vite build"
else
    echo "Building full application..."
    sudo -u $DEPLOY_USER bash -c "cd $APP_DIR && npm run build"
fi

# Run database migrations as nodejs user (with environment variables loaded)
echo "Running database migrations..."
# Continue even if migrations fail (tables might already exist)
sudo -u $DEPLOY_USER bash -c "set -a && source $APP_DIR/.env.production && set +a && cd $APP_DIR && npm run db:migrate:all" || echo "Warning: Migration had issues, but continuing deployment..."

# Remove devDependencies if they were installed (only if we did full install)
if [ ! -d "$APP_DIR/dist/public" ] || [ ! -f "$APP_DIR/dist/index.js" ]; then
    echo "Removing devDependencies..."
    sudo -u $DEPLOY_USER bash -c "cd $APP_DIR && npm prune --production"
else
    echo "✓ Production dependencies only, skipping prune step..."
fi

# Verify .env.production file exists
if [ ! -f "$APP_DIR/.env.production" ]; then
    echo "ERROR: .env.production file not found!"
    echo "Please create .env.production on the server with required environment variables:"
    echo "  - DATABASE_URL"
    echo "  - SESSION_SECRET"
    echo "  - PORT (optional, defaults to 8000)"
    exit 1
fi

echo "✓ .env.production file found"

# Start the application
echo "Starting application..."
sudo systemctl start $SERVICE_NAME

# Wait for application to be healthy
echo "Waiting for application to start..."
sleep 10

# Health check
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
        echo "✓ Application is healthy!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for health check... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "ERROR: Application failed to start"
    echo "Checking logs..."
    sudo journalctl -u $SERVICE_NAME -n 50 --no-pager || true
    
    echo "Rolling back to previous version..."
    
    # Rollback
    LATEST_BACKUP=$(sudo find "$BACKUP_DIR" -name "bondcoffeepos-*.tar.gz" -type f | sort -r | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        echo "Restoring from: $LATEST_BACKUP"
        cd "$APP_DIR"
        sudo tar -xzf "$LATEST_BACKUP"
        sudo chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR"
        sudo systemctl start $SERVICE_NAME
    fi
    
    exit 1
fi

# Cleanup
rm -f /tmp/bondcoffeepos-deploy.tar.gz

echo "====== Deployment Complete ======"
echo "Timestamp: $(date)"
echo "Application URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):$PORT"

