FROM node:20-slim

WORKDIR /app

# Build tools required for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build Next.js app
COPY . .
RUN npm run build

# Ensure data directory exists (Railway will mount a volume here)
RUN mkdir -p /app/data

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
