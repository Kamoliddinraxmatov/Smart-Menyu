#!/bin/bash
# Smart Menyu serverini bir buyruq bilan o'rnatish (Ubuntu 22.04/24.04).
# Ishlatish:  sudo bash setup.sh menyu.sizningdomen.uz
set -e
DOMAIN="$1"
if [ -z "$DOMAIN" ]; then echo "Domen kiriting: sudo bash setup.sh menyu.domen.uz"; exit 1; fi
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
cd "$(dirname "$0")"
# Qayta ishga tushirilsa (yangilash) parol o'zgarmaydi: planshetlar ulanib turaveradi
PASS=$(grep -s '^MQTT_PASS=' .env | cut -d= -f2-)
if [ -z "$PASS" ] && [ -s passwd ]; then
  # Server avval eski versiya bilan o'rnatilgan: parolni egasi ilovasidagi Sozlamalar > Server bo'limidan oling
  read -r -p "Server paroli (Egasi ilovasi > Sozlamalar > Server): " PASS
fi
if [ -z "$PASS" ]; then
  PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)
  touch passwd
  docker run --rm -v "$PWD/passwd:/passwd" eclipse-mosquitto:2 mosquitto_passwd -b /passwd smartmenyu "$PASS"
fi
printf 'DOMAIN=%s\nMQTT_PASS=%s\n' "$DOMAIN" "$PASS" > .env
chmod 600 .env
docker compose up -d --build
echo
echo "================ TAYYOR ================"
echo "Server manzili:  wss://$DOMAIN/mqtt"
echo "Login:           smartmenyu"
echo "Parol:           $PASS"
echo "Shu uchtasini Smart Menyu Egasi ilovasida: Sozlamalar > Server bo'limiga kiriting."
echo "========================================"
