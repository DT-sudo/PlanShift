#!/bin/sh
set -eu

CERT_DIR=/etc/nginx/certs
CERT="$CERT_DIR/transcendence.crt"
KEY="$CERT_DIR/transcendence.key"

mkdir -p "$CERT_DIR"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    if ! command -v openssl >/dev/null 2>&1; then
        echo "==> Installing openssl"
        apk add --no-cache openssl >/dev/null
    fi

    echo "==> Generating self-signed TLS certificate"
    openssl req -x509 -nodes -newkey rsa:2048 \
        -days 365 \
        -keyout "$KEY" \
        -out "$CERT" \
        -subj "/C=CZ/O=ft_transcendence/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,DNS:transcendence.local,IP:127.0.0.1" \
        2>/dev/null
    chmod 600 "$KEY"
fi

export HTTPS_PORT="${HTTPS_PORT:-8443}"
envsubst '${HTTPS_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

echo "==> Starting nginx (TLS on 443)"
exec nginx -g 'daemon off;'
