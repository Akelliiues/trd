#!/bin/bash
# ==============================================================================
# Deploy TradingTools Workstation to trd.ssotansum.com
# ==============================================================================

SERVER_IP="trd.ssotansum.com"
SERVER_USER="root"
REMOTE_PATH="/var/www/trd.ssotansum.com"

echo "=========================================================="
echo " [*] Deploying TradingTools Workstation to $SERVER_IP"
echo "=========================================================="

# 1. Create remote directory
echo "[1/4] Ensuring remote directory exists..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_PATH/data $REMOTE_PATH/icons $REMOTE_PATH/js $REMOTE_PATH/scripts"

# 2. Sync files via Rsync or SCP
echo "[2/4] Uploading files to server..."
rsync -avz --exclude '.git' --exclude '__pycache__' ./ $SERVER_USER@$SERVER_IP:$REMOTE_PATH/

# 3. Setup Systemd Service & Nginx
echo "[3/4] Configuring Systemd service & Nginx..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
cp /var/www/trd.ssotansum.com/tradingtools.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable tradingtools
systemctl restart tradingtools

if [ -f /var/www/trd.ssotansum.com/nginx_trd.ssotansum.com.conf ]; then
    cp /var/www/trd.ssotansum.com/nginx_trd.ssotansum.com.conf /etc/nginx/sites-available/trd.ssotansum.com
    ln -sf /etc/nginx/sites-available/trd.ssotansum.com /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
fi
EOF

# 4. Check Health Status
echo "[4/4] Verifying health status..."
sleep 2
curl -I https://trd.ssotansum.com/api/health || curl -I http://$SERVER_IP:3000/api/health

echo "=========================================================="
echo " 🎉 Deployment Complete! Access via:"
echo " 👉 https://trd.ssotansum.com"
echo "=========================================================="
