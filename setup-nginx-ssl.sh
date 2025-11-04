#!/bin/bash
set -e

# Setup script for Nginx and SSL for LocalPOS
# Domain: bfcpos.com

echo "====== Setting up Nginx and SSL for bfcpos.com ======"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Install Nginx
echo -e "${YELLOW}Step 1: Installing Nginx...${NC}"
sudo apt update
sudo apt install -y nginx

# 2. Install Certbot
echo -e "${YELLOW}Step 2: Installing Certbot...${NC}"
sudo apt install -y certbot python3-certbot-nginx

# 3. Check DNS configuration
echo -e "${YELLOW}Step 3: Checking DNS configuration...${NC}"
echo "Please ensure the following DNS records are set:"
echo "  A record: bfcpos.com -> $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "  A record: www.bfcpos.com -> $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo ""
read -p "Have you configured DNS records? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please configure DNS records first, then run this script again."
    exit 1
fi

# 4. Copy Nginx configuration
echo -e "${YELLOW}Step 4: Configuring Nginx...${NC}"
sudo cp /var/www/localpos/nginx.conf /etc/nginx/sites-available/bfcpos.com
sudo ln -sf /etc/nginx/sites-available/bfcpos.com /etc/nginx/sites-enabled/

# Remove default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# 5. Test Nginx configuration
echo -e "${YELLOW}Step 5: Testing Nginx configuration...${NC}"
sudo nginx -t

# 6. Start Nginx
echo -e "${YELLOW}Step 6: Starting Nginx...${NC}"
sudo systemctl start nginx
sudo systemctl enable nginx

# 7. Configure firewall
echo -e "${YELLOW}Step 7: Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw allow 'Nginx Full'
    sudo ufw allow OpenSSH
    echo "Firewall configured. Make sure ports 80 and 443 are open in AWS Security Groups too!"
else
    echo "UFW not found. Please ensure ports 80 and 443 are open in AWS Security Groups."
fi

# 8. Get SSL certificate
echo -e "${YELLOW}Step 8: Obtaining SSL certificate from Let's Encrypt...${NC}"
echo "This will prompt for email and agreement to terms."
sudo certbot --nginx -d bfcpos.com -d www.bfcpos.com --non-interactive --agree-tos --redirect

# 9. Test auto-renewal
echo -e "${YELLOW}Step 9: Testing SSL certificate auto-renewal...${NC}"
sudo certbot renew --dry-run

# 10. Verify Nginx status
echo -e "${YELLOW}Step 10: Verifying Nginx status...${NC}"
sudo systemctl status nginx --no-pager

echo ""
echo -e "${GREEN}====== Setup Complete! ======${NC}"
echo ""
echo "Your application should now be accessible at:"
echo "  https://bfcpos.com"
echo "  https://www.bfcpos.com"
echo ""
echo "To check SSL certificate status:"
echo "  sudo certbot certificates"
echo ""
echo "To view Nginx logs:"
echo "  sudo tail -f /var/log/nginx/bfcpos-access.log"
echo "  sudo tail -f /var/log/nginx/bfcpos-error.log"
echo ""
echo "To reload Nginx after configuration changes:"
echo "  sudo nginx -t && sudo systemctl reload nginx"

