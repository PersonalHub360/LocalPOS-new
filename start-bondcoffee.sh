#!/bin/bash
# Bond Coffee POS System - Startup Wrapper Script
# This script loads environment variables from .env.production before starting PM2
set -e

# Load environment variables
set -a
source /var/www/bondcoffeepos/.env.production
set +a

# Start PM2 in runtime mode (foreground)
exec /usr/bin/pm2-runtime start /var/www/bondcoffeepos/ecosystem.config.cjs --env production

