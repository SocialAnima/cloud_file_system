#!/usr/bin/env bash
#
# 资源下载中心 - 云服务器一键部署脚本
#
# 用法:
#   chmod +x scripts/deploy.sh
#   sudo ./scripts/deploy.sh                    # 使用 IP 访问 (HTTP 80)
#   sudo ./scripts/deploy.sh --domain xxx.com   # 使用域名 (自动 HTTPS)
#   sudo ./scripts/deploy.sh --update           # 更新代码后重新部署
#   sudo ./scripts/deploy.sh --help
#
set -euo pipefail

# ─── 默认配置（可通过环境变量覆盖）────────────────────────────
APP_NAME="${APP_NAME:-resource-center}"
APP_PORT="${APP_PORT:-3000}"
DOMAIN="${DOMAIN:-}"
INSTALL_DIR="${INSTALL_DIR:-}"
APP_USER="${APP_USER:-}"
BASE_PATH="${BASE_PATH:-/cloud_file_system}"
SKIP_CADDY="${SKIP_CADDY:-0}"
UPDATE_ONLY="${UPDATE_ONLY:-0}"
SKIP_SYSTEM_PACKAGES="${SKIP_SYSTEM_PACKAGES:-0}"

# ─── 颜色输出 ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

usage() {
  cat <<'EOF'
资源下载中心 - 云服务器一键部署

用法:
  sudo ./scripts/deploy.sh [选项]

选项:
  --domain <域名>         绑定域名并自动申请 HTTPS（不填则用 IP + HTTP 80）
  --port <端口>           应用内部端口（默认 3000）
  --dir <路径>            项目安装目录（默认：脚本所在项目根目录）
  --user <用户名>         运行服务的系统用户（默认：当前登录用户）
  --base-path <路径>      网站子路径（默认 /cloud_file_system）
  --skip-caddy            跳过 Caddy 安装与配置（仅启动应用服务）
  --skip-packages         跳过 apt 系统包安装
  --update                更新模式：不安装系统依赖，重新构建并重启服务
  --help                  显示帮助

示例:
  sudo ./scripts/deploy.sh
  sudo ./scripts/deploy.sh --domain download.example.com
  sudo ./scripts/deploy.sh --update

环境变量（可选）:
  APP_NAME, APP_PORT, DOMAIN, INSTALL_DIR, APP_USER, BASE_PATH

部署前请确保云厂商安全组已放行: 22, 80, 443
EOF
}

# ─── 解析参数 ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --port) APP_PORT="$2"; shift 2 ;;
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --user) APP_USER="$2"; shift 2 ;;
    --base-path) BASE_PATH="$2"; shift 2 ;;
    --skip-caddy) SKIP_CADDY=1; shift ;;
    --skip-packages) SKIP_SYSTEM_PACKAGES=1; shift ;;
    --update) UPDATE_ONLY=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) error "未知参数: $1"; usage; exit 1 ;;
  esac
done

# 规范化 BASE_PATH（必须以 / 开头，不以 / 结尾）
BASE_PATH="/${BASE_PATH#/}"
BASE_PATH="${BASE_PATH%/}"

# ─── 基础检查 ────────────────────────────────────────────────
if [[ "$(uname -s)" != "Linux" ]]; then
  error "此脚本仅支持 Linux 云服务器"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -z "$INSTALL_DIR" ]]; then
  INSTALL_DIR="$PROJECT_ROOT"
fi

if [[ -z "$APP_USER" ]]; then
  if [[ -n "${SUDO_USER:-}" ]]; then
    APP_USER="$SUDO_USER"
  else
    APP_USER="$(whoami)"
  fi
fi

if [[ ! -f "$INSTALL_DIR/package.json" ]]; then
  error "未找到 package.json，请确认项目目录: $INSTALL_DIR"
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  error "请使用 sudo 运行此脚本（systemd / Caddy 需要 root 权限）"
  exit 1
fi

if ! id "$APP_USER" &>/dev/null; then
  error "用户不存在: $APP_USER"
  exit 1
fi

APP_USER_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
DB_PATH="$INSTALL_DIR/db/custom.db"
ENV_FILE="$INSTALL_DIR/.env"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
CADDY_FILE="/etc/caddy/Caddyfile"

info "项目目录: $INSTALL_DIR"
info "运行用户: $APP_USER"
info "应用端口: $APP_PORT"
if [[ -n "$DOMAIN" ]]; then
  info "访问地址: https://${DOMAIN}${BASE_PATH}"
else
  info "访问路径: http://<公网IP>${BASE_PATH}"
fi

# ─── 安装系统依赖 ────────────────────────────────────────────
install_system_packages() {
  if [[ "$SKIP_SYSTEM_PACKAGES" == "1" ]]; then
    warn "跳过系统包安装"
    return
  fi

  info "安装系统依赖..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates gnupg unzip build-essential
  ok "系统依赖安装完成"
}

# ─── 安装 Bun ────────────────────────────────────────────────
install_bun() {
  local bun_bin="$APP_USER_HOME/.bun/bin/bun"

  if [[ -x "$bun_bin" ]]; then
    ok "Bun 已安装: $bun_bin"
    return
  fi

  info "为 $APP_USER 安装 Bun..."
  run_as_user "curl -fsSL https://bun.sh/install | bash"
  ok "Bun 安装完成"
}

run_as_user() {
  local cmd="$1"
  su - "$APP_USER" -c "cd '$INSTALL_DIR' && $cmd"
}

get_bun_path() {
  local bun_bin="$APP_USER_HOME/.bun/bin/bun"
  if [[ -x "$bun_bin" ]]; then
    echo "$bun_bin"
  else
    error "未找到 Bun: $bun_bin"
    exit 1
  fi
}

# ─── 安装 Caddy ──────────────────────────────────────────────
install_caddy() {
  if [[ "$SKIP_CADDY" == "1" ]]; then
    warn "跳过 Caddy 安装"
    return
  fi

  if command -v caddy &>/dev/null; then
    ok "Caddy 已安装"
    return
  fi

  info "安装 Caddy..."
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
  ok "Caddy 安装完成"
}

# ─── 配置环境变量 ────────────────────────────────────────────
setup_env() {
  mkdir -p "$INSTALL_DIR/db" "$INSTALL_DIR/uploads"
  chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/db" "$INSTALL_DIR/uploads"

  info "写入 .env..."
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=file:${DB_PATH}
BASE_PATH=${BASE_PATH}
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  ok ".env 已创建 (DB: ${DB_PATH})"
}

# ─── 构建应用 ────────────────────────────────────────────────
build_app() {
  local bun_path
  bun_path="$(get_bun_path)"

  info "安装依赖..."
  run_as_user "$bun_path install"

  info "生成 Prisma Client..."
  run_as_user "$bun_path run db:generate"

  info "初始化数据库..."
  run_as_user "$bun_path run db:push"

  info "构建生产版本（basePath: ${BASE_PATH}，可能需要几分钟）..."
  run_as_user "BASE_PATH='${BASE_PATH}' $bun_path run build"

  ok "应用构建完成"
}

# ─── 配置 systemd ────────────────────────────────────────────
setup_systemd() {
  local bun_path
  bun_path="$(get_bun_path)"

  info "配置 systemd 服务: $APP_NAME"

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Resource Download Center
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
EnvironmentFile=${ENV_FILE}
ExecStart=${bun_path} .next/standalone/server.js
Restart=on-failure
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$APP_NAME" >/dev/null
  systemctl restart "$APP_NAME"

  sleep 2
  if systemctl is-active --quiet "$APP_NAME"; then
    ok "服务已启动: $APP_NAME"
  else
    error "服务启动失败，查看日志: journalctl -u $APP_NAME -n 50 --no-pager"
    exit 1
  fi
}

# ─── 配置 Caddy ──────────────────────────────────────────────
setup_caddy() {
  if [[ "$SKIP_CADDY" == "1" ]]; then
    warn "未配置反向代理，应用仅监听 localhost:${APP_PORT}"
    warn "如需外网访问，请自行配置 Nginx/Caddy 或放行端口"
    return
  fi

  info "配置 Caddy 反向代理..."

  if [[ -n "$DOMAIN" ]]; then
    cat > "$CADDY_FILE" <<EOF
${DOMAIN} {
    reverse_proxy localhost:${APP_PORT}
}
EOF
  else
    cat > "$CADDY_FILE" <<EOF
:80 {
    reverse_proxy localhost:${APP_PORT}
}
EOF
  fi

  systemctl enable caddy >/dev/null 2>&1 || true
  systemctl restart caddy

  sleep 1
  if systemctl is-active --quiet caddy; then
    ok "Caddy 已启动"
  else
    warn "Caddy 启动异常，查看日志: journalctl -u caddy -n 50 --no-pager"
  fi
}

# ─── 健康检查 ────────────────────────────────────────────────
health_check() {
  info "健康检查..."
  local retries=10
  local i=0

  while [[ $i -lt $retries ]]; do
    if curl -fsS "http://127.0.0.1:${APP_PORT}${BASE_PATH}/api" >/dev/null 2>&1; then
      ok "应用响应正常 (http://127.0.0.1:${APP_PORT}${BASE_PATH})"
      return
    fi
    i=$((i + 1))
    sleep 2
  done

  warn "健康检查未通过，服务可能仍在启动中"
  warn "手动检查: curl http://127.0.0.1:${APP_PORT}${BASE_PATH}/api"
}

# ─── 打印部署结果 ────────────────────────────────────────────
print_summary() {
  echo ""
  echo "============================================"
  echo -e "${GREEN}部署完成！${NC}"
  echo "============================================"
  echo "项目目录:   $INSTALL_DIR"
  echo "数据目录:   $INSTALL_DIR/db"
  echo "上传目录:   $INSTALL_DIR/uploads"
  echo "服务名称:   $APP_NAME"
  echo ""
  echo "访问路径:   ${BASE_PATH}"
  if [[ -n "$DOMAIN" ]]; then
    echo "访问地址:   https://${DOMAIN}${BASE_PATH}"
  else
    echo "访问地址:   http://<你的公网IP>${BASE_PATH}"
    echo "示例:       http://106.54.199.248${BASE_PATH}"
  fi
  echo "管理密码:   admin123（请登录后立即修改）"
  echo ""
  echo "常用命令:"
  echo "  查看状态: systemctl status $APP_NAME"
  echo "  查看日志: journalctl -u $APP_NAME -f"
  echo "  重启服务: systemctl restart $APP_NAME"
  echo "  更新部署: sudo $INSTALL_DIR/scripts/deploy.sh --update"
  echo ""
  echo "请确认云厂商安全组已放行: 22, 80, 443"
  echo "============================================"
}

# ─── 主流程 ──────────────────────────────────────────────────
main() {
  if [[ "$UPDATE_ONLY" == "1" ]]; then
    info "更新模式：重新构建并重启服务"
    setup_env
    build_app
    setup_systemd
    health_check
    print_summary
    exit 0
  fi

  install_system_packages
  install_bun
  install_caddy
  setup_env
  build_app
  setup_systemd
  setup_caddy
  health_check
  print_summary
}

main
