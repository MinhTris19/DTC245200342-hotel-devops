#!/usr/bin/env bash
set -e

CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"

VM_IP="192.168.1.6"

echo "Generating self-signed SSL Certificate for $VM_IP, localhost, 127.0.0.1..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -subj "/C=VN/ST=DaNang/L=DaNang/O=HotelDevOps/OU=IT/CN=$VM_IP" \
  -addext "subjectAltName = IP:$VM_IP,IP:127.0.0.1,DNS:localhost"

chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

echo "Certificate and Key generated successfully in $CERT_DIR"
