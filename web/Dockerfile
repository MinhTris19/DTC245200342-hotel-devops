FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/public/uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "src/app.js"]
