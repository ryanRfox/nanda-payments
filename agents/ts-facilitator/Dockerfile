FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/facilitator/package.json packages/facilitator/
COPY packages/sdk/package.json packages/sdk/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY packages/ packages/
COPY tsconfig.json ./

# Build the application
WORKDIR /app/packages/facilitator
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S facilitator -u 1001

# Copy built application and production dependencies
COPY --from=builder /app/packages/facilitator/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/facilitator/package.json ./

# Install curl for health checks
RUN apk add --no-cache curl

# Set proper ownership
RUN chown -R facilitator:nodejs /app

# Switch to non-root user
USER facilitator

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "dist/server.js"]