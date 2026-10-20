# Image pour les hébergeurs qui utilisent Docker (Railway, Fly.io, un VPS...).
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY client ./client
EXPOSE 3000
CMD ["node", "server/index.js"]
