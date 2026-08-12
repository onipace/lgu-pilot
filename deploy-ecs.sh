#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# eSANGGUNI Pricing Calculator — Alibaba Cloud ECS Sandbox Deployment
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./deploy-ecs.sh [deploy|status|logs|help]
#
# Prerequisites:
#   - SSH key for the ECS sandbox (ecs-user@8.220.189.33:22).
#     Default: $HOME/Downloads/evc-demo-key-pair_85fe9d77-42a9-4b11-9aa6-9a5a170017fd.pem
#     Override with:  SSH_KEY_PATH=/path/to/key.pem ./deploy-ecs.sh deploy
#   - Docker and Docker Compose installed on the ECS instance
#   - rsync available locally (runs from Git Bash on Windows)
#
# Note: the container binds to 0.0.0.0:3060 on the ECS host (all
# interfaces, plain HTTP). Health verification runs on the host itself.
# External access requires the Alibaba Cloud security group to allow
# inbound TCP 3060; an SSH tunnel works as a fallback either way.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
ECS_HOST="8.220.189.33"
ECS_PORT="22"
ECS_USER="ecs-user"
SSH_KEY="${SSH_KEY_PATH:-$HOME/Downloads/evc-demo-key-pair_85fe9d77-42a9-4b11-9aa6-9a5a170017fd.pem}"
REMOTE_DIR="/opt/qoder-deployments/esangguni-calculator"
APP_DIR="pricing-calculator"
COMPOSE_FILE="docker-compose.ecs.yml"
CONTAINER_NAME="esangguni-calculator"
APP_PORT="3060"
PUBLIC_URL="http://${ECS_HOST}:${APP_PORT}"

# ── Color output ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[eSANGGUNI-ECS]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
info()  { echo -e "${BLUE}[INFO]${NC} $1"; }

# ── SSH key validation (never prints key contents) ─────────────
verify_key() {
    if [ ! -f "$SSH_KEY" ]; then
        error "SSH private key not found: $SSH_KEY"
        error "Place the QoderWork ECS key there, or override with:"
        error "  SSH_KEY_PATH=/path/to/key.pem $0 <command>"
        exit 1
    fi
}

# Function-based wrappers (safe for paths with spaces, unlike $SSH_CMD strings)
ssh_cmd() {
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o IdentitiesOnly=yes \
        -p "$ECS_PORT" \
        "${ECS_USER}@${ECS_HOST}" "$@"
}

# ── Functions ─────────────────────────────────────────────────

sync_code() {
    log "Syncing ${APP_DIR}/ to ECS (${ECS_USER}@${ECS_HOST}:${REMOTE_DIR})..."

    ssh_cmd "mkdir -p ${REMOTE_DIR}"

    if command -v rsync >/dev/null 2>&1; then
        rsync -avz --delete \
            --exclude='node_modules' \
            --exclude='.next' \
            --exclude='.git' \
            --exclude='.env*' \
            --exclude='*.tsbuildinfo' \
            -e "ssh -i \"${SSH_KEY}\" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p ${ECS_PORT}" \
            "${APP_DIR}/" "${ECS_USER}@${ECS_HOST}:${REMOTE_DIR}/"
    else
        # Fallback for environments without rsync (e.g. stock Git Bash on
        # Windows): tar locally -> scp -> extract remotely, then prune
        # excluded paths. Same exclusion semantics as the rsync path.
        warn "rsync not found — falling back to tar/scp sync."
        local ARCHIVE
        ARCHIVE="${TMPDIR:-/tmp}/esangguni-ecs-$$.tar.gz"
        tar -czf "${ARCHIVE}" \
            --exclude='node_modules' \
            --exclude='.next' \
            --exclude='.git' \
            --exclude='.env*' \
            --exclude='*.tsbuildinfo' \
            -C "${APP_DIR}" .
        scp -i "${SSH_KEY}" \
            -o StrictHostKeyChecking=no \
            -o IdentitiesOnly=yes \
            -P "${ECS_PORT}" \
            "${ARCHIVE}" "${ECS_USER}@${ECS_HOST}:${REMOTE_DIR}/.esangguni-sync.tar.gz"
        rm -f "${ARCHIVE}"
        ssh_cmd "cd ${REMOTE_DIR} && tar -xzf .esangguni-sync.tar.gz && rm -f .esangguni-sync.tar.gz && rm -rf node_modules .next .git *.tsbuildinfo"
    fi

    log "Code sync complete."
}

build_and_start() {
    log "Building and starting eSANGGUNI Pricing Calculator on ECS..."
    ssh_cmd << EOF
        set -e
        cd ${REMOTE_DIR}

        echo "Building image..."
        docker compose -f ${COMPOSE_FILE} build

        echo "Starting container..."
        docker compose -f ${COMPOSE_FILE} up -d

        echo "Waiting for container to become healthy..."
        HEALTHY=0
        for i in \$(seq 1 12); do
            if curl -fsS http://127.0.0.1:${APP_PORT}/ >/dev/null 2>&1 \
               || wget -qO- http://127.0.0.1:${APP_PORT}/ >/dev/null 2>&1; then
                HEALTHY=1
                break
            fi
            sleep 5
        done

        if [ "\$HEALTHY" = "1" ]; then
            echo "eSANGGUNI Pricing Calculator is up (http://127.0.0.1:${APP_PORT}/)"
            docker ps --filter name=${CONTAINER_NAME} --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
        else
            echo "ERROR: service failed to respond within 60s. Checking logs..."
            docker logs ${CONTAINER_NAME} --tail 50
            exit 1
        fi
EOF
}

verify_external() {
    info "Checking external endpoint: ${PUBLIC_URL}"
    if command -v curl >/dev/null 2>&1; then
        if curl -fsS --max-time 10 "${PUBLIC_URL}/" >/dev/null 2>&1; then
            log "External health check passed: ${PUBLIC_URL}"
            return 0
        fi
    fi
    warn "External endpoint ${PUBLIC_URL} is not reachable from here."
    warn "Check the Alibaba Cloud security group allows inbound TCP ${APP_PORT}"
    warn "(the app serves plain HTTP only — use http://, not https://)."
    warn "Fallback: SSH tunnel, e.g.:"
    warn "  ssh -i \"\$SSH_KEY\" -p ${ECS_PORT} -L ${APP_PORT}:127.0.0.1:${APP_PORT} ${ECS_USER}@${ECS_HOST}"
    warn "Then open http://localhost:${APP_PORT}/"
    return 0
}

status() {
    log "eSANGGUNI Pricing Calculator — ECS status:"
    ssh_cmd << EOF
        echo "=== Container Status ==="
        docker ps -a --filter name=${CONTAINER_NAME} --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'

        echo ""
        echo "=== Health Check (http://127.0.0.1:${APP_PORT}/) ==="
        if curl -fsS http://127.0.0.1:${APP_PORT}/ >/dev/null 2>&1 || wget -qO- http://127.0.0.1:${APP_PORT}/ >/dev/null 2>&1; then
            echo "OK — service responding"
        else
            echo "Health check failed"
        fi

        echo ""
        echo "=== Resource Usage ==="
        docker stats ${CONTAINER_NAME} --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' 2>/dev/null || echo "Container not running"
EOF
}

logs() {
    local LINES=${1:-50}
    # Validate before interpolating into the remote command (injection guard).
    if ! [[ "$LINES" =~ ^[0-9]+$ ]]; then
        error "logs: line count must be a positive integer (got: '$LINES')"
        exit 1
    fi
    ssh_cmd "docker logs ${CONTAINER_NAME} --tail ${LINES} 2>&1"
}

# ── Main ──────────────────────────────────────────────────────

verify_key

case "${1:-help}" in
    deploy)
        log "Starting eSANGGUNI Pricing Calculator ECS deployment..."
        sync_code
        build_and_start
        verify_external
        log "Deployment complete!"
        log "URL: ${PUBLIC_URL}"
        ;;
    status)
        status
        ;;
    logs)
        logs "${2:-50}"
        ;;
    help|*)
        echo "eSANGGUNI Pricing Calculator — ECS Sandbox Deployment"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  deploy     Full deployment (rsync + build + start + health check)"
        echo "  status     Show container status and health"
        echo "  logs [n]   Show last n lines of logs (default: 50)"
        echo "  help       Show this help"
        echo ""
        echo "Configuration:"
        echo "  Target:      ${ECS_USER}@${ECS_HOST}:${ECS_PORT} -> ${REMOTE_DIR}"
        echo "  SSH key:     ${SSH_KEY} (override: SSH_KEY_PATH)"
        echo "  Endpoint:    ${PUBLIC_URL} (plain HTTP; needs security-group rule for TCP ${APP_PORT})"
        ;;
esac
