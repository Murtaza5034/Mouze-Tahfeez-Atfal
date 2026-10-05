# ============================================
# Mauze Tahfeez WhatsApp 24/7 Bot Daemon
# ============================================
FROM node:20-bullseye-slim

WORKDIR /app

# Install fonts and SSL certificates required for canvas / SVG rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fontconfig \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies only
RUN npm ci --legacy-peer-deps --omit=dev

# Copy all application and bot scripts
COPY . .

# Expose default port
EXPOSE 2785

# Start WhatsApp Multi-Device bot daemon
CMD ["node", "scripts/mauze-whatsapp-bot.js"]
