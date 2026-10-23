#!/usr/bin/env bash
# simulate_bruteforce.sh - Mo phong 20 yeu cau dang nhap sai lien tiep vao Hotel Booking Web App
set -e

COOKIE_JAR="/tmp/hotel_bruteforce_cookies.txt"
LOGIN_URL="https://localhost/login"

echo "=== BAT DAU MO PHONG TAN CONG BRUTE FORCE DANG NHAP ==="
echo "Thoi gian bat dau: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# 1. Lay cookie session va CSRF token
echo "1. Dang lay trang login de lay CSRF token va cookie session..."
rm -f "$COOKIE_JAR"
LOGIN_PAGE=$(curl -k -s -c "$COOKIE_JAR" "$LOGIN_URL")
CSRF_TOKEN=$(echo "$LOGIN_PAGE" | grep -o 'name="_csrf" value="[^"]*"' | head -n 1 | cut -d'"' -f4)

if [ -z "$CSRF_TOKEN" ]; then
    echo "Loi: Khong tim thay CSRF token tren trang login!"
    exit 1
fi
echo "CSRF token thu duoc: $CSRF_TOKEN"

# 2. Gui 20 lan dang nhap sai voi user admin
echo "2. Gui 20 lan dang nhap that bai (LOGIN_FAILED) lien tiep cach nhau ~0.5s..."
for i in $(seq 1 20); do
    WRONG_PASS="WrongPassword_#${i}_$(date +%s)"
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" \
        -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
        -X POST "$LOGIN_URL" \
        -d "_csrf=${CSRF_TOKEN}" \
        -d "username=admin" \
        -d "password=${WRONG_PASS}")
    
    echo "  [Lan $i/20] POST /login user=admin pass=$WRONG_PASS -> HTTP $HTTP_CODE"
    sleep 0.5
done

echo "=== MO PHONG HOAN TAT ==="
echo "Thoi gian ket thuc: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
