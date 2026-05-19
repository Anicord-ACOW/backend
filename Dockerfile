# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install

# Stage 2: Build the app
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner (The final image)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT
RUN test -n "$GIT_COMMIT" || \
    (echo "ERROR: GIT_COMMIT build arg is required. Build with: docker compose build --build-arg GIT_COMMIT=\$(git rev-parse HEAD)" >&2; exit 1)

# Copy only the necessary files from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/package.json ./

EXPOSE 3000
ENV PORT 3000
CMD ["npm", "start"]