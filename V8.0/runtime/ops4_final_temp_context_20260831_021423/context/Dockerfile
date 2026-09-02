FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY dist ./dist

ENV NODE_ENV=test
ENV PORT=3110

CMD ["node","dist/main.js"]
