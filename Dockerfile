# ============================================
# Multi-stage Docker Build for Mauze Tahfeez
# Stage 1: Build with Node.js
# Stage 2: Serve with Nginx (production-fast)
# ============================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Set build environment
ENV NODE_ENV=production
ENV VITE_FIREBASE_VAPID_KEY=${VITE_FIREBASE_VAPID_KEY}

# Build the Vite React app
RUN npm run build

# --- Stage 2: Serve ---
FROM nginx:alpine AS production

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx site
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
