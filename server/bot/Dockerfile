# Smart Menyu Telegram bot xizmati. Qurish konteksti: repozitoriy ildizi (docker-compose.yml'da ko'rsatilgan).
FROM node:22-alpine
WORKDIR /app
COPY server/bot/package.json server/bot/package-lock.json server/bot/
RUN cd server/bot && npm ci --omit=dev
COPY js/crypto.js js/owner-key.js js/plan.js js/
COPY server/bot/bot.mjs server/bot/
CMD ["node", "server/bot/bot.mjs"]
