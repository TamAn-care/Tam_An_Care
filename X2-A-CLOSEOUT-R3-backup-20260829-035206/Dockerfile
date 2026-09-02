FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json nest-cli.json ./
COPY src ./src
COPY assets ./assets
RUN npm run build
EXPOSE 3000
CMD ["npm","run","start:prod"]
