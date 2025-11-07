#!/bin/bash
# Adora POS System - Startup Wrapper Script
# This script loads environment variables from .env.production before starting PM2
set -e

# Load environment variables
set -a
source /var/www/adorapos/.env.production
set +a

# Start PM2 in runtime mode (foreground)
exec /home/nodejs/node_modules/.bin/pm2-runtime start /var/www/adorapos/ecosystem.config.cjs --env production

