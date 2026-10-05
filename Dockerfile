# ============================================
# Mauze Tahfeez WhatsApp 24/7 Bot Daemon
# ============================================
FROM node:22-slim

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies only (using prebuilt binaries)
RUN npm ci --legacy-peer-deps --omit=dev

# Copy all application and bot scripts
COPY . .

# Ports: Expose 2785, 8080, and Railway dynamic PORT
ENV PORT=2785
EXPOSE 2785 8080 3000

# Start WhatsApp Multi-Device bot daemon
CMD ["node", "scripts/mauze-whatsapp-bot.js"]
