# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm via npm (avoids corepack network call in Railway CI)
RUN npm install -g pnpm@9

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: Runner (production image)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Install pnpm via npm (avoids corepack network call in Railway CI)
RUN npm install -g pnpm@9

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package manifests
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/pipeline/prompts /app/dist/pipeline/prompts

# Switch to non-root user
USER appuser

EXPOSE 3000

CMD ["node", "dist/server.js"]
