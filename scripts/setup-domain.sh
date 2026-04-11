#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo bash scripts/setup-domain.sh clientsay.ru www.clientsay.ru 95.81.124.145 3000
#
# What it does:
# 1) Waits until DNS resolves both domains to expected IP
# 2) Writes nginx config for reverse proxy to localhost:PORT
# 3) Reloads nginx and checks HTTP health
# 4) If certbot exists, obtains/renews TLS cert and reloads nginx

DOMAIN="${1:-clientsay.ru}"
WWW_DOMAIN="${2:-www.clientsay.ru}"
EXPECTED_IP="${3:-95.81.124.145}"
APP_PORT="${4:-3000}"
HEALTH_PATH="/api/health"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0 ..."
  exit 1
fi

echo "== Waiting for DNS =="
echo "domain=$DOMAIN www=$WWW_DOMAIN expected_ip=$EXPECTED_IP"
for i in $(seq 1 60); do
  ip1="$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}' || true)"
  ip2="$(getent ahostsv4 "$WWW_DOMAIN" | awk '{print $1; exit}' || true)"
  if [[ "$ip1" == "$EXPECTED_IP" && "$ip2" == "$EXPECTED_IP" ]]; then
    echo "DNS OK: $DOMAIN->$ip1, $WWW_DOMAIN->$ip2"
    break
  fi
  echo "[$i/60] waiting DNS... now: $DOMAIN=${ip1:-none}, $WWW_DOMAIN=${ip2:-none}"
  sleep 10
done

ip1="$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}' || true)"
ip2="$(getent ahostsv4 "$WWW_DOMAIN" | awk '{print $1; exit}' || true)"
if [[ "$ip1" != "$EXPECTED_IP" || "$ip2" != "$EXPECTED_IP" ]]; then
  echo "DNS not ready. Configure A records first:"
  echo "  @   -> $EXPECTED_IP"
  echo "  www -> $EXPECTED_IP"
  exit 2
fi

echo "== Writing nginx config =="
cat > /etc/nginx/conf.d/clientsay.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

nginx -t
systemctl reload nginx

echo "== HTTP health check =="
curl -fsS "http://127.0.0.1:$APP_PORT$HEALTH_PATH" >/dev/null
curl -i -sS "http://$DOMAIN$HEALTH_PATH" | sed -n '1,12p'
curl -i -sS "http://$WWW_DOMAIN$HEALTH_PATH" | sed -n '1,12p'

if command -v certbot >/dev/null 2>&1; then
  echo "== Enabling HTTPS via certbot =="
  certbot --nginx -d "$DOMAIN" -d "$WWW_DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || {
    echo "certbot failed (likely rate-limit/email). Continue with HTTP config."
    exit 0
  }
  nginx -t
  systemctl reload nginx
  echo "== HTTPS health check =="
  curl -i -sS "https://$DOMAIN$HEALTH_PATH" | sed -n '1,12p'
  curl -i -sS "https://$WWW_DOMAIN$HEALTH_PATH" | sed -n '1,12p'
else
  echo "certbot not installed. Install then run:"
  echo "  certbot --nginx -d $DOMAIN -d $WWW_DOMAIN"
fi

echo "Done."
