#!/usr/bin/env bash
# ============================================================================
# DlxAI 一键部署脚本
# 部署 cloud-api (Node) + website (Astro 静态站) + Nginx 反代
#
# 使用方式:
#   1. 把整个 deploy/ 目录上传到服务器
#   2. 修改下面的配置变量
#   3. bash deploy.sh
#
# 前置要求: Node 20+, PostgreSQL, Nginx, PM2
# ============================================================================
set -euo pipefail

# ─── 配置（部署前必须修改） ────────────────────────────────────────────
DOMAIN="dlxai.app"                          # 你的域名
CLOUD_API_PORT=3100                         # cloud-api 端口
DB_URL="postgresql://postgres:123@localhost:5432/dlxai_credits"
OPENROUTER_KEY=""                           # OpenRouter master key
ADMIN_KEY="change-me-to-a-secret"           # 发版管理密钥
DEPLOY_DIR="/opt/dlxai"                     # 服务器部署目录
# ───────────────────────────────────────────────────────────────────────

echo "=== DlxAI Deploy ==="
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. 创建目录
echo ">> Creating directories..."
sudo mkdir -p "$DEPLOY_DIR"/{cloud-api,website}
sudo chown -R "$USER:$USER" "$DEPLOY_DIR"

# 2. 部署 cloud-api
echo ">> Deploying cloud-api..."
cp -r "$SCRIPT_DIR/cloud-api/"* "$DEPLOY_DIR/cloud-api/"

cat > "$DEPLOY_DIR/cloud-api/.env" <<EOF
DATABASE_URL=$DB_URL
OPENROUTER_MASTER_KEY=$OPENROUTER_KEY
ADMIN_KEY=$ADMIN_KEY
FREE_CREDITS=100
DAILY_FREE_TOKENS=100000
PORT=$CLOUD_API_PORT
NODE_ENV=production
EOF

cd "$DEPLOY_DIR/cloud-api"
npm install --omit=dev

# 初始化数据库
echo ">> Initializing database..."
node -e "
const postgres = require('postgres');
const fs = require('fs');
const sql = postgres('$DB_URL');
(async () => {
  const schema = fs.readFileSync('schema.sql', 'utf-8');
  for (const stmt of schema.split(';').filter(s => s.trim())) {
    await sql.unsafe(stmt).catch(e => console.log('  skip:', e.message));
  }
  console.log('Database schema applied');
  await sql.end();
})();
"

# 3. 部署 website
echo ">> Deploying website..."
cp -r "$SCRIPT_DIR/website/"* "$DEPLOY_DIR/website/"

# 4. PM2 ecosystem 配置
echo ">> Setting up PM2..."
cat > "$DEPLOY_DIR/cloud-api/ecosystem.config.cjs" <<'PMEOF'
module.exports = {
  apps: [{
    name: "dlxai-api",
    script: "dist/index.js",
    env_file: ".env",
    max_memory_restart: "300M",
    instances: 1,
    autorestart: true,
  }]
};
PMEOF

cd "$DEPLOY_DIR/cloud-api"
pm2 delete dlxai-api 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# 5. Nginx 配置
echo ">> Configuring Nginx..."

# 检测 Nginx 配置目录
if [ -d /etc/nginx/sites-available ]; then
  NGINX_CONF="/etc/nginx/sites-available/dlxai"
  NGINX_LINK="/etc/nginx/sites-enabled/dlxai"
else
  NGINX_CONF="/etc/nginx/conf.d/dlxai.conf"
  NGINX_LINK=""
fi

sudo tee "$NGINX_CONF" > /dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # 官网 (Astro 静态站)
    root $DEPLOY_DIR/website;
    index index.html;

    location / {
        try_files \$uri \$uri/ \$uri/index.html =404;
    }

    # cloud-api 反代
    location /api/ {
        proxy_pass http://127.0.0.1:$CLOUD_API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # SSE 支持 (版本更新推送)
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:$CLOUD_API_PORT;
    }
}
NGINX

if [ -n "$NGINX_LINK" ]; then
  sudo ln -sf "$NGINX_CONF" "$NGINX_LINK"
fi

sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "============================================="
echo "  部署完成!"
echo "============================================="
echo ""
echo "  官网:       http://$DOMAIN"
echo "  API 健康:   http://$DOMAIN/health"
echo "  发版命令:"
echo "    curl -X POST http://$DOMAIN/api/releases \\"
echo "      -H 'X-Admin-Key: $ADMIN_KEY' \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"version\":\"1.0.0\", \"downloadUrl\":\"https://...\"}'"
echo ""
echo "  下一步: 启用 HTTPS"
echo "    sudo apt install -y certbot python3-certbot-nginx"
echo "    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
