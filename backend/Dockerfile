FROM node:18-slim

WORKDIR /app

# Install dependencies for TensorFlow.js
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
