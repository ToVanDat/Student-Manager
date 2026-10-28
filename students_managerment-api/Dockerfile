FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# The API package-lock.json is committed; use npm ci for reproducible image builds.
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
