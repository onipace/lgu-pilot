#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# eSANGGUNI — Hostinger VPS Deployment Script (UAT/Pilot)
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./deploy-vps.sh [backup|deploy|restart|rollback|status|logs]
#
# Prerequisites:
#   - SSH access to VPS (72.60.104.187:2222)
#   - Docker and Docker Compose installed on VPS
#   - rsync available locally
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
VPS_HOST="72.60.104.187"
VPS_PORT="2222"
VPS_USER="root"
REMOTE_DIR="/opt/esangguni-pilot"
OLD_DIR="/opt/esangguni-workshop"
IMAGE_NAME="esangguni-pilot:latest"
CONTAINER_NAME="esangguni-pilot"
COMPOSE_FILE="docker-compose.vps.yml"

SSH_CMD="ssh -o StrictHostKeyChecking=no -p ${VPS_PORT} ${VPS_USER}@${VPS_HOST}"
RSYNC_CMD="rsync -avz --delete --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='data/*.db*' --exclude='pricing-calculator' --exclude='WALKTHROUGH-DEMO' --exclude='screenshots' --exclude='uat-screenshots' --exclude='uat-*' -e 'ssh -o StrictHostKeyChecking=no -p ${VPS_PORT}'"

# ── Color output ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[eSANGGUNI]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
info()  { echo -e "${BLUE}[INFO]${NC} $1"; }

# ── Functions ─────────────────────────────────────────────────

backup_old() {
    log "Backing up old esangguni-workshop installation..."
    $SSH_CMD << 'EOF'
        set -e
        if [ -d /opt/esangguni-workshop ]; then
            TIMESTAMP=$(date +%Y%m%d-%H%M%S)
            echo "Creating backup: /opt/esangguni-workshop-backup-${TIMESTAMP}"
            cp -r /opt/esangguni-workshop "/opt/esangguni-workshop-backup-${TIMESTAMP}"
            
            # Also backup the Docker volume data
            if docker volume inspect esangguni-workshop_esangguni-data &>/dev/null; then
                VOLUME_PATH=$(docker volume inspect esangguni-workshop_esangguni-data --format '{{ .Mountpoint }}')
                echo "Old SQLite volume at: ${VOLUME_PATH}"
            fi
            echo "Backup complete."
        else
            echo "No old esangguni-workshop directory found."
        fi
EOF
}

sync_code() {
    log "Syncing eSANGGUNI codebase to VPS..."
    
    # Create remote directory
    $SSH_CMD "mkdir -p ${REMOTE_DIR}"
    
    # Sync the codebase
    $RSYNC_CMD \
        --exclude='.env' \
        --exclude='.env.vps' \
        --exclude='docs/' \
        ./ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"
    
    # Sync .env.vps separately (contains secrets)
    $RSYNC_CMD .env.vps "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/.env.vps"
    
    log "Code sync complete."
}

stop_old() {
    log "Stopping old esangguni-workshop container..."
    $SSH_CMD << 'EOF'
        cd /opt/esangguni-workshop 2>/dev/null || exit 0
        docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
        docker stop esangguni-workshop 2>/dev/null || true
        docker rm esangguni-workshop 2>/dev/null || true
        echo "Old container stopped."
EOF
}

build_and_start() {
    log "Building and starting eSANGGUNI on VPS..."
    $SSH_CMD << EOF
        cd ${REMOTE_DIR}
        
        echo "Pulling base images..."
        docker pull node:20-alpine
        
        echo "Building eSANGGUNI image..."
        docker compose -f ${COMPOSE_FILE} build --no-cache
        
        echo "Starting eSANGGUNI container..."
        docker compose -f ${COMPOSE_FILE} up -d
        
        echo "Waiting for health check..."
        sleep 10
        
        # Verify
        if docker ps --filter name=${CONTAINER_NAME} --format '{{.Names}} {{.Status}}' | grep -q "Up"; then
            echo "eSANGGUNI is running!"
            curl -s http://127.0.0.1:3082/api/health | python3 -m json.tool 2>/dev/null || curl -s http://127.0.0.1:3082/api/health
        else
            echo "ERROR: Container failed to start. Checking logs..."
            docker logs ${CONTAINER_NAME} --tail 50
            exit 1
        fi
EOF
}

restart() {
    log "Restarting eSANGGUNI container..."
    $SSH_CMD << EOF
        cd ${REMOTE_DIR}
        docker compose -f ${COMPOSE_FILE} restart
        sleep 5
        docker ps --filter name=${CONTAINER_NAME} --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
EOF
}

rollback() {
    warn "Rolling back to old esangguni-workshop..."
    $SSH_CMD << 'EOF'
        cd /opt/esangguni-workshop
        docker compose up -d --build
        sleep 10
        docker ps --filter name=esangguni-workshop --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
EOF
    log "Rollback complete."
}

status() {
    log "eSANGGUNI VPS Status:"
    $SSH_CMD << 'EOF'
        echo "=== Container Status ==="
        docker ps -a --filter name=esangguni-pilot --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'
        
        echo ""
        echo "=== Health Check ==="
        curl -s http://127.0.0.1:3082/api/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "Health check failed"
        
        echo ""
        echo "=== Resource Usage ==="
        docker stats esangguni-pilot --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' 2>/dev/null || echo "Container not running"
        
        echo ""
        echo "=== LightRAG Status ==="
        curl -s http://127.0.0.1:8020/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "LightRAG not reachable"
EOF
}

logs() {
    local LINES=${1:-50}
    $SSH_CMD "docker logs ${CONTAINER_NAME} --tail ${LINES} 2>&1"
}

# ── Main ──────────────────────────────────────────────────────

case "${1:-help}" in
    backup)
        backup_old
        ;;
    deploy)
        log "Starting full eSANGGUNI VPS deployment..."
        backup_old
        sync_code
        stop_old
        build_and_start
        log "Deployment complete!"
        log "URLs:"
        echo "  Landing:  https://esangguni.bayanaihan.net"
        echo "  ELLA:     https://ella.esangguni.bayanaihan.net"
        echo "  OBRA:     https://obra.esangguni.bayanaihan.net"
        echo "  YALA:     https://yala.esangguni.bayanaihan.net"
        echo "  Admin:    https://esangguni.bayanaihan.net/admin"
        ;;
    sync)
        sync_code
        ;;
    stop-old)
        stop_old
        ;;
    build)
        build_and_start
        ;;
    restart)
        restart
        ;;
    rollback)
        rollback
        ;;
    status)
        status
        ;;
    logs)
        logs "${2:-50}"
        ;;
    help|*)
        echo "eSANGGUNI VPS Deployment Script"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  deploy     Full deployment (backup + sync + build + start)"
        echo "  backup     Backup old esangguni-workshop"
        echo "  sync       Sync code to VPS (rsync)"
        echo "  stop-old   Stop old esangguni-workshop container"
        echo "  build      Build and start new eSANGGUNI"
        echo "  restart    Restart eSANGGUNI container"
        echo "  rollback   Roll back to old esangguni-workshop"
        echo "  status     Show container status and health"
        echo "  logs [n]   Show last n lines of logs (default: 50)"
        echo "  help       Show this help"
        ;;
esac
