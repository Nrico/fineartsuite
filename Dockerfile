# Build stage: install dev dependencies and generate front-end assets
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Compile Tailwind CSS into the public folder
RUN npm run build:css

# Production stage: install only runtime deps and copy built assets
FROM node:20 AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Overwrite with built CSS from the build stage so styling is available
COPY --from=build /app/public/css ./public/css

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
