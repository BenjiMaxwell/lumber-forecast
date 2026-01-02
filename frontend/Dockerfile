# Build stage
FROM node:18-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV REACT_APP_API_URL=/api
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
