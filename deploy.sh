#!/bin/bash
# ============================================
# 轻图社资源仓库 - 阿里云部署脚本
# ============================================
# 使用方法:
#   1. 将此脚本上传到阿里云服务器
#   2. chmod +x deploy.sh
#   3. sudo ./deploy.sh
#
# 前置条件:
#   - 阿里云ECS实例 (Ubuntu/CentOS)
#   - 已开放80/443端口
#   - 已配置域名解析到服务器IP
# ============================================

set -e

# ===== 配置区域 =====
REPO_URL="https://github.com/gengmu5588-ship-it/gengmu-list.git"
DEPLOY_DIR="/var/www/gallery-site"
NGINX_CONF_DIR="/etc/nginx"
DOMAIN="lsj.tbaosearch.asia"
ADMIN_DOMAIN="api-lsj.tbaosearch.asia"
BRANCH="main"
# ====================

echo "========================================="
echo "  轻图社资源仓库 - 阿里云一键部署"
echo "========================================="

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "无法检测操作系统"
    exit 1
fi

echo "检测到操作系统: $OS"

# 1. 安装依赖
echo ""
echo "[1/6] 安装系统依赖..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get update -y
    apt-get install -y git nginx curl
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    yum install -y git nginx curl
else
    echo "不支持的操作系统: $OS"
    exit 1
fi

# 2. 克隆仓库
echo ""
echo "[2/6] 克隆代码仓库..."
if [ -d "$DEPLOY_DIR" ]; then
    echo "目录已存在，拉取最新代码..."
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    mkdir -p "$(dirname "$DEPLOY_DIR")"
    git clone -b "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

echo "当前代码版本:"
git log --oneline -1

# 3. 配置Nginx
echo ""
echo "[3/6] 配置Nginx..."
cat > "$NGINX_CONF_DIR/conf.d/gallery-site.conf" << 'NGINX_CONF'
# 前台用户页面
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    root /var/www/gallery-site;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location ~ /\. {
        deny all;
    }
}

# 后台管理页面
server {
    listen 80;
    server_name ADMIN_DOMAIN_PLACEHOLDER;
    root /var/www/gallery-site;
    index admin.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location / {
        try_files $uri $uri/ /admin.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location ~ /\. {
        deny all;
    }
}
NGINX_CONF

# 替换域名
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_CONF_DIR/conf.d/gallery-site.conf"
sed -i "s/ADMIN_DOMAIN_PLACEHOLDER/$ADMIN_DOMAIN/g" "$NGINX_CONF_DIR/conf.d/gallery-site.conf"

# 测试Nginx配置
nginx -t

# 4. 启动Nginx
echo ""
echo "[4/6] 启动Nginx..."
systemctl enable nginx
systemctl restart nginx

# 5. 创建自动更新脚本
echo ""
echo "[5/6] 配置自动更新..."
cat > /usr/local/bin/gallery-update.sh << 'UPDATE_SCRIPT'
#!/bin/bash
# 轻图社资源仓库 - 自动更新脚本
# 通过git pull实现代码实时更新

DEPLOY_DIR="/var/www/gallery-site"
BRANCH="main"
LOG_FILE="/var/log/gallery-update.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') - 开始更新..." >> "$LOG_FILE"

cd "$DEPLOY_DIR"

# 获取当前版本
OLD_COMMIT=$(git rev-parse HEAD)

# 拉取最新代码
git fetch origin
git reset --hard "origin/$BRANCH"

# 获取新版本
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" != "$NEW_COMMIT" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 更新成功: $OLD_COMMIT -> $NEW_COMMIT" >> "$LOG_FILE"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 更新内容:" >> "$LOG_FILE"
    git log --oneline "$OLD_COMMIT..$NEW_COMMIT" >> "$LOG_FILE"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 已是最新版本" >> "$LOG_FILE"
fi
UPDATE_SCRIPT

chmod +x /usr/local/bin/gallery-update.sh

# 6. 配置定时拉取（每5分钟检查一次更新）
echo ""
echo "[6/6] 配置定时更新任务..."
CRON_JOB="*/5 * * * * /usr/local/bin/gallery-update.sh"
(crontab -l 2>/dev/null | grep -v "gallery-update.sh"; echo "$CRON_JOB") | crontab -

echo ""
echo "========================================="
echo "  部署完成!"
echo "========================================="
echo ""
echo "  前台地址: http://$DOMAIN"
echo "  后台地址: http://$ADMIN_DOMAIN"
echo "  部署目录: $DEPLOY_DIR"
echo "  更新脚本: /usr/local/bin/gallery-update.sh"
echo "  更新日志: /var/log/gallery-update.log"
echo "  定时策略: 每5分钟自动检查更新"
echo ""
echo "  手动更新命令: /usr/local/bin/gallery-update.sh"
echo "  查看更新日志: tail -f /var/log/gallery-update.log"
echo ""
echo "  如需配置HTTPS，请执行:"
echo "  curl https://get.acme.sh | sh"
echo "  ~/.acme.sh/acme.sh --issue -d $DOMAIN --webroot $DEPLOY_DIR"
echo "========================================="
