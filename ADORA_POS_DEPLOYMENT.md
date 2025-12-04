# Adora POS Deployment Steps

## Prerequisites
- BFC POS and Bond Coffee POS are already deployed
- You have SSH access to the server
- You have the deployment package ready

---

## Step 1: Build and Create Package (Local Machine)

```bash
cd LocalPOS-new

# Clean previous build
rm -rf dist

# Build the application
npm run build

# Create Adora POS deployment package
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
  deploy-adora.sh start-adora.sh ecosystem-adora.config.cjs adorapos.service nginx-adora.conf SETUP_ADORA_POS.sh
```

---

## Step 2: Upload Package to Server

```bash
scp -i "C:\Users\Mike Samuel\Downloads\adora-server-key.pem" adorapos-deploy.tar.gz ubuntu@ec2-13-214-171-202.ap-southeast-1.compute.amazonaws.com:/tmp/
```

---

## Step 3: Initial Setup on Server (First Time Only)

SSH into the server and run:

```bash
# Create directory and extract package
cd /var/www
sudo mkdir -p adorapos
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite

# Run the setup script (creates database, .env.production, systemd service, nginx config)
sudo chmod +x /var/www/adorapos/SETUP_ADORA_POS.sh
sudo /var/www/adorapos/SETUP_ADORA_POS.sh
```

The setup script will:
- Create `/var/www/adorapos` directory structure
- Create PostgreSQL database `adorapos_db` and user `adorapos_user`
- Create `.env.production` file with database credentials
- Install systemd service
- Setup Nginx configuration

---

## Step 4: Deploy Application Files

```bash
cd /var/www/adorapos

# Extract deployment package (if not already extracted)
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite

# Rename ecosystem config file
sudo mv /var/www/adorapos/ecosystem-adora.config.cjs /var/www/adorapos/ecosystem.config.cjs 2>/dev/null || true

# Rename start script
sudo mv /var/www/adorapos/start-adora.sh /var/www/adorapos/start.sh 2>/dev/null || true

# Fix PM2 path in start.sh if needed
sudo sed -i 's|/home/nodejs/node_modules/.bin/pm2-runtime|/usr/bin/pm2-runtime|g' /var/www/adorapos/start.sh 2>/dev/null || true
sudo chmod +x /var/www/adorapos/start.sh

# Set ownership
sudo chown -R nodejs:nodejs /var/www/adorapos

# Install dependencies
sudo -u nodejs bash -c "cd /var/www/adorapos && npm install --production --no-audit --no-fund"
```

---

## Step 5: Run Database Migrations (First Time Only)

```bash
cd /var/www/adorapos
sudo -u nodejs bash -c "source .env.production && npm run db:migrate"
```

This will:
- Create all database tables
- Create admin user: `admin@adorapos.com` with password: `Admin@2024`

---

## Step 6: Start the Service

```bash
# Start the service
sudo systemctl start adorapos

# Enable it to start on boot
sudo systemctl enable adorapos

# Check status
sudo systemctl status adorapos
```

---

## Step 7: Verify Deployment

```bash
# Wait a few seconds for service to start
sleep 5

# Check health endpoint
curl http://localhost:9000/health

# Check service status
sudo systemctl status adorapos

# Check logs if needed
sudo journalctl -u adorapos -n 30 --no-pager
```

Expected output from health check:
```json
{"status":"ok","timestamp":"..."}
```

---

## Step 8: Configure Nginx (If Not Done by Setup Script)

```bash
# Copy Nginx config
sudo cp /var/www/adorapos/nginx-adora.conf /etc/nginx/sites-available/adora-pos.conf

# Enable the site
sudo ln -sf /etc/nginx/sites-available/adora-pos.conf /etc/nginx/sites-enabled/adora-pos.conf

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 9: Setup SSL Certificate (After DNS is Configured)

```bash
sudo certbot --nginx -d adora.bfcpos.com -d www.adora.bfcpos.com
```

---

## Step 10: Verify Everything Works

```bash
# Check all three services are running
curl http://localhost:7000/health  # BFC POS
curl http://localhost:8000/health  # Bond Coffee POS
curl http://localhost:9000/health  # Adora POS

# Check service statuses
sudo systemctl status bfcpos bondcoffeepos adorapos
```

---

## Configuration Summary

| Item | Value |
|------|-------|
| **Port** | 9000 |
| **Domain** | adora.bfcpos.com |
| **Database** | adorapos_db |
| **Database User** | adorapos_user |
| **Database Password** | AdoraPOS2024!Secure |
| **Admin Email** | admin@adorapos.com |
| **Admin Password** | Admin@2024 |
| **Service Name** | adorapos |
| **Log Directory** | /var/log/adorapos |

---

## Regular Deployment (After Initial Setup)

For future deployments, you only need:

```bash
# Upload new package
scp -i "C:\Users\Mike Samuel\Downloads\adora-server-key.pem" adorapos-deploy.tar.gz ubuntu@ec2-13-214-171-202.ap-southeast-1.compute.amazonaws.com:/tmp/

# On server:
cd /var/www/adorapos
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite
sudo mv ecosystem-adora.config.cjs ecosystem.config.cjs 2>/dev/null || true
sudo mv start-adora.sh start.sh 2>/dev/null || true
sudo chmod +x start.sh
sudo chown -R nodejs:nodejs /var/www/adorapos
sudo -u nodejs bash -c "cd /var/www/adorapos && npm install --production --no-audit --no-fund"
sudo systemctl restart adorapos

# Verify
curl http://localhost:9000/health
```

---

## Troubleshooting

### Service not starting:
```bash
# Check logs
sudo journalctl -u adorapos -n 50 --no-pager

# Check if port 9000 is in use
sudo netstat -tlnp | grep 9000

# Check .env.production
sudo -u nodejs bash -c "cd /var/www/adorapos && cat .env.production"
```

### Database connection issues:
```bash
# Test database connection
sudo -u postgres psql -d adorapos_db -c "SELECT 1;"

# Check if database exists
sudo -u postgres psql -c "\l" | grep adorapos_db
```

### Nginx issues:
```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/adora-pos-error.log
```

---

## Quick Commands Reference

```bash
# Restart service
sudo systemctl restart adorapos

# Stop service
sudo systemctl stop adorapos

# Start service
sudo systemctl start adorapos

# Check status
sudo systemctl status adorapos

# View logs
sudo journalctl -u adorapos -f

# Check health
curl http://localhost:9000/health
```

