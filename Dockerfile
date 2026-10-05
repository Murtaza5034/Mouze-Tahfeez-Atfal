# ============================================
# Mauze Tahfeez WhatsApp 24/7 Bot Daemon
# ============================================
FROM node:22-slim

WORKDIR /app

# Install essential system libraries for native modules and font rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fontconfig \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies only
RUN npm ci --legacy-peer-deps --omit=dev

# Copy all application and bot scripts
COPY . .

# Expose default port
ENV PORT=2785
EXPOSE 2785

# Start WhatsApp Multi-Device bot daemon
CMD ["node", "scripts/mauze-whatsapp-bot.js"]
