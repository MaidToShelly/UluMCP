# Ubuntu Service Setup

Deploy UluMCP as a systemd service with TLS on Ubuntu.

**Domain:** `ulumcp.nautilus.sh`

## Prerequisites

- Ubuntu 22.04+
- Node.js 20+
- DNS A record pointing `ulumcp.nautilus.sh` to the server IP
- Local algod and indexer endpoints (or use Nodely defaults)

## 1. Clone and install

```bash
sudo mkdir -p /opt/ulu-mcp
sudo chown $USER:$USER /opt/ulu-mcp
git clone https://github.com/anthropics/UluMCP.git /opt/ulu-mcp
cd /opt/ulu-mcp
npm install --production
```

## 2. Create environment file

```bash
sudo cp /opt/ulu-mcp/.env.example /etc/ulu-mcp.env
sudo chmod 600 /etc/ulu-mcp.env
sudo nano /etc/ulu-mcp.env
```

Contents:

```bash
# Voi endpoints (local)
VOI_MAINNET_ALGOD_URL=http://localhost:8080
VOI_MAINNET_ALGOD_TOKEN=
VOI_MAINNET_INDEXER_URL=http://localhost:8981
VOI_MAINNET_INDEXER_TOKEN=

# Algorand endpoints (local or Nodely)
# ALGORAND_MAINNET_ALGOD_URL=http://localhost:4001
# ALGORAND_MAINNET_INDEXER_URL=http://localhost:8980

# x402 payment gating
X402_AVM_PAY_TO=<your-voi-address>
X402_AVM_PRICE=1000000
X402_AVM_ASSET=0
X402_AVM_NETWORK=avm:voi-mainnet

# Server
MCP_PORT=3000
```

## 3. Create systemd service

```bash
sudo nano /etc/systemd/system/ulu-mcp.service
```

```ini
[Unit]
Description=UluMCP Server (x402)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ulu-mcp
ExecStart=/usr/bin/node serve.js
EnvironmentFile=/etc/ulu-mcp.env
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## 4. Enable and start

```bash
sudo systemctl daemon-reload
sudo systemctl enable ulu-mcp
sudo systemctl start ulu-mcp
sudo systemctl status ulu-mcp
```

Verify it's running:

```bash
curl -s http://localhost:3000/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}},"id":1}'
```

## 5. Configure nginx with TLS

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

```bash
sudo nano /etc/nginx/sites-available/ulumcp.nautilus.sh
```

```nginx
server {
    listen 80;
    server_name ulumcp.nautilus.sh;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ulumcp.nautilus.sh /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d ulumcp.nautilus.sh
```

Certbot auto-renews via systemd timer.

Verify TLS:

```bash
curl -s https://ulumcp.nautilus.sh/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}},"id":1}'
```

## 6. Client configuration

MCP clients connect via URL:

```json
{
  "mcpServers": {
    "ulu-mcp": {
      "url": "https://ulumcp.nautilus.sh/mcp"
    }
  }
}
```

Or via mcporter:

```bash
mcporter config add ulu-remote --url https://ulumcp.nautilus.sh/mcp
```

## Management

```bash
# Logs
sudo journalctl -u ulu-mcp -f

# Restart after code update
cd /opt/ulu-mcp && git pull && npm install --production
sudo systemctl restart ulu-mcp

# Nginx logs
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log

# Check certificate status
sudo certbot certificates

# Force certificate renewal
sudo certbot renew --dry-run
```
