# Use Node.js 20 LTS image
FROM node:20

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# Build CSS assets
RUN npm run build:css

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
