# DlxAI 部署指南

将官网（静态站）和后端（cloud-api）部署到 Linux 服务器。

## 服务器要求

- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Node.js 20+
- PostgreSQL 14+
- Nginx
- PM2（`npm i -g pm2`）

---

## 一、服务器环境准备

如果服务器已有 Node/PostgreSQL/Nginx 可跳过对应步骤。

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser --superuser $USER 2>/dev/null || true
createdb dlxai_credits

# Nginx
sudo apt install -y nginx

# PM2
sudo npm i -g pm2
pm2 startup  # 开机自启，按提示执行输出的命令
```

---

## 二、本地打包

在你的开发机上执行：

```bash
cd /d/work/dlxiaclaw
bash deploy/pack.sh
```

打包完成后 `deploy/` 目录结构：

```
deploy/
├── cloud-api/          # 后端 API
│   ├── dist/           # 编译后的 JS
│   ├── package.json
│   └── schema.sql      # 数据库建表语句
├── website/            # 官网静态文件
│   ├── index.html
│   ├── en/
│   ├── docs/
│   └── _astro/
├── deploy.sh           # 服务器部署脚本
└── README.md           # 本文档
```

---

## 三、上传到服务器

```bash
scp -r deploy/ root@你的服务器IP:/tmp/dlxai-deploy/
```

---

## 四、在服务器上部署

### 4.1 编辑配置

```bash
ssh root@你的服务器IP
cd /tmp/dlxai-deploy
vim deploy.sh
```

修改顶部的配置变量：

```bash
DOMAIN="dlxai.app"                          # 改成你的域名
CLOUD_API_PORT=3100                         # API 端口，一般不用改
DB_URL="postgresql://postgres:密码@localhost:5432/dlxai_credits"  # 数据库连接
OPENROUTER_KEY="sk-or-v1-xxx"              # 你的 OpenRouter API Key
ADMIN_KEY="你的管理密钥"                     # 发版用的密钥，随便设一个长字符串
DEPLOY_DIR="/opt/dlxai"                     # 部署目录，一般不用改
```

### 4.2 执行部署

```bash
bash deploy.sh
```

脚本会自动完成：
1. 复制文件到 `/opt/dlxai/`
2. 生成 `.env` 配置
3. 安装 npm 依赖
4. 初始化数据库表
5. 用 PM2 启动 cloud-api
6. 配置 Nginx 反代

### 4.3 验证

```bash
# 健康检查
curl http://localhost:3100/health
# 返回 {"ok":true} 表示后端正常

# 通过 Nginx 访问
curl http://你的域名/health
curl http://你的域名/api/credits/balance  # 应返回 401（未认证，正常）

# 官网
curl -s http://你的域名/ | head -5  # 应返回 HTML
```

---

## 五、启用 HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名 -d www.你的域名
```

Certbot 会自动修改 Nginx 配置并设置自动续期。

---

## 六、日常运维

### 查看 API 日志

```bash
pm2 logs dlxai-api
pm2 logs dlxai-api --lines 100  # 最近 100 行
```

### 重启 API

```bash
pm2 restart dlxai-api
```

### 更新代码

在开发机上：
```bash
bash deploy/pack.sh
scp -r deploy/cloud-api/ root@服务器:/tmp/dlxai-update/
scp -r deploy/website/ root@服务器:/tmp/dlxai-update-web/
```

在服务器上：
```bash
cp -r /tmp/dlxai-update/* /opt/dlxai/cloud-api/
cd /opt/dlxai/cloud-api && npm install --omit=dev
pm2 restart dlxai-api

cp -r /tmp/dlxai-update-web/* /opt/dlxai/website/
# 静态站无需重启
```

### 发布新版本（推送更新给客户端）

```bash
curl -X POST https://你的域名/api/releases \
  -H "X-Admin-Key: 你的管理密钥" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0.1",
    "downloadUrl": "https://你的域名/releases/DlxAI-1.0.1-win.exe",
    "notes": "修复了一些问题"
  }'
```

所有在线的桌面客户端会通过 SSE 实时收到更新通知。

### 查看数据库

```bash
psql dlxai_credits

-- 用户数
SELECT COUNT(*) FROM users;

-- 最近注册
SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 10;

-- 积分消耗排行
SELECT user_id, SUM(ABS(delta)) as total FROM credit_ledger WHERE reason='consumption' GROUP BY user_id ORDER BY total DESC LIMIT 10;

-- 已发布版本
SELECT * FROM app_releases ORDER BY published_at DESC;
```

---

## 目录结构（部署后）

```
/opt/dlxai/
├── cloud-api/
│   ├── dist/           # Node.js API
│   ├── node_modules/
│   ├── package.json
│   ├── schema.sql
│   └── .env            # 环境变量（自动生成）
└── website/            # Nginx 直接托管的静态文件
    ├── index.html
    ├── en/
    ├── docs/
    └── _astro/
```

---

## 常见问题

**Q: deploy.sh 报错 "permission denied"**
```bash
chmod +x deploy.sh
```

**Q: Nginx 报错 "sites-available not found"**
CentOS/RHEL 没有 sites-available 目录，改为：
```bash
sudo vim /etc/nginx/conf.d/dlxai.conf  # 把 Nginx 配置写到这里
sudo nginx -t && sudo systemctl reload nginx
```

**Q: PM2 重启后 .env 没加载**
PM2 用 `--env-path` 可能不支持旧版本，改用 ecosystem 文件：
```bash
cat > /opt/dlxai/cloud-api/ecosystem.config.cjs <<'EOF'
module.exports = {
  apps: [{
    name: "dlxai-api",
    script: "dist/index.js",
    env_file: ".env",
    max_memory_restart: "300M",
  }]
};
EOF
cd /opt/dlxai/cloud-api
pm2 start ecosystem.config.cjs
pm2 save
```

**Q: 数据库连接失败**
检查 PostgreSQL 是否允许本地连接：
```bash
sudo vim /etc/postgresql/*/main/pg_hba.conf
# 确保有这行: local all all trust (或 md5)
sudo systemctl restart postgresql
```
