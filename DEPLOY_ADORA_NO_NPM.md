# Deploy Adora POS Without npm install (Crash-Safe Method)

## Server: ec2-13-214-145-23.ap-southeast-1.compute.amazonaws.com

This method copies node_modules from existing instances to avoid npm install crashes.

---

## Step 1: Upload Package (From Local Machine)

```bash
cd /d/replit-old/LocalPOS-new
scp -i "C:\Users\Mike Samuel\Downloads\adora-server-key.pem" adorapos-deploy.tar.gz ubuntu@ec2-13-214-145-23.ap-southeast-1.compute.amazonaws.com:/tmp/
```

---

## Step 2: Deploy on Server (SSH First)

```bash
# SSH into server
ssh -i "C:\Users\Mike Samuel\Downloads\adora-server-key.pem" ubuntu@ec2-13-214-145-23.ap-southeast-1.compute.amazonaws.com

# Step 1: Setup directory and extract
cd /var/www
sudo mkdir -p adorapos
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite

# Step 2: Run setup script
sudo chmod +x /var/www/adorapos/SETUP_ADORA_POS.sh
sudo /var/www/adorapos/SETUP_ADORA_POS.sh

# Step 3: Configure files
cd /var/www/adorapos
sudo mv ecosystem-adora.config.cjs ecosystem.config.cjs 2>/dev/null || true
sudo mv start-adora.sh start.sh 2>/dev/null || true
sudo sed -i 's|/home/nodejs/node_modules/.bin/pm2-runtime|/usr/bin/pm2-runtime|g' start.sh 2>/dev/null || true
sudo chmod +x start.sh
sudo chown -R nodejs:nodejs /var/www/adorapos
```

---

## Step 3: Copy node_modules (NO npm install!)

```bash
cd /var/www/adorapos

# Remove any existing node_modules
sudo rm -rf node_modules package-lock.json

# Copy from BFC POS (or Bond Coffee if BFC doesn't exist)
sudo cp -r /var/www/bfcpos/node_modules /var/www/adorapos/ 2>/dev/null || sudo cp -r /var/www/bondcoffeepos/node_modules /var/www/adorapos/

# Set correct ownership
sudo chown -R nodejs:nodejs /var/www/adorapos/node_modules

# Verify key packages exist
ls -la /var/www/adorapos/node_modules/drizzle-orm/ && echo "✅ drizzle-orm found"
ls -la /var/www/adorapos/node_modules/pg/ && echo "✅ pg found"
ls -la /var/www/adorapos/node_modules/express/ && echo "✅ express found"
```

---

## Step 4: Run Migrations

```bash
cd /var/www/adorapos
sudo -u nodejs bash -c "source .env.production && npm run db:migrate:all"
```

This should detect Adora POS and create `admin@adorapos.com` with password `Admin@2024`.

---

## Step 5: Fix Admin User (If Needed)

```bash
cd /var/www/adorapos
sudo -u nodejs bash -c "source .env.production && PORT=9000 node scripts/fix-admin-passwords.js"
```

---

## Step 6: Start Service

```bash
sudo systemctl start adorapos
sudo systemctl enable adorapos
sudo systemctl status adorapos
```

---

## Step 7: Verify

```bash
sleep 5
curl http://localhost:9000/health
```

Should return: `{"status":"ok","timestamp":"..."}`

---

## Step 8: Setup SSL

```bash
# Temporarily disable Cloudflare proxy (gray cloud) for adora.bfcpos.com
# Wait 2-3 minutes, then:
sudo certbot --nginx -d adora.bfcpos.com -d www.adora.bfcpos.com

# After SSL is installed, re-enable Cloudflare proxy (orange cloud)
```

---

## All-in-One Script (Copy Method - No npm install)

```bash
# On server, run all at once:
cd /var/www && \
sudo mkdir -p adorapos && \
sudo tar -xzf /tmp/adorapos-deploy.tar.gz -C /var/www/adorapos --overwrite && \
sudo chmod +x /var/www/adorapos/SETUP_ADORA_POS.sh && \
sudo /var/www/adorapos/SETUP_ADORA_POS.sh && \
cd /var/www/adorapos && \
sudo mv ecosystem-adora.config.cjs ecosystem.config.cjs 2>/dev/null || true && \
sudo mv start-adora.sh start.sh 2>/dev/null || true && \
sudo sed -i 's|/home/nodejs/node_modules/.bin/pm2-runtime|/usr/bin/pm2-runtime|g' start.sh 2>/dev/null || true && \
sudo chmod +x start.sh && \
sudo chown -R nodejs:nodejs /var/www/adorapos && \
sudo rm -rf /var/www/adorapos/node_modules && \
sudo cp -r /var/www/bfcpos/node_modules /var/www/adorapos/ 2>/dev/null || sudo cp -r /var/www/bondcoffeepos/node_modules /var/www/adorapos/ && \
sudo chown -R nodejs:nodejs /var/www/adorapos/node_modules && \
sudo -u nodejs bash -c "cd /var/www/adorapos && source .env.production && npm run db:migrate:all" && \
sudo -u nodejs bash -c "cd /var/www/adorapos && source .env.production && PORT=9000 node scripts/fix-admin-passwords.js" && \
sudo systemctl start adorapos && \
sudo systemctl enable adorapos && \
sleep 5 && \
curl http://localhost:9000/health && \
sudo systemctl status adorapos
```

---

## Troubleshooting

If service doesn't start:
```bash
# Check logs
sudo journalctl -u adorapos -n 50 --no-pager

# Check if port is in use
sudo ss -tlnp | grep 9000

# Verify node_modules
ls -la /var/www/adorapos/node_modules/drizzle-orm/
```

