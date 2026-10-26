FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# This repository currently does not track a package-lock.json, so npm ci would fail.
# Prefer adding and committing a lockfile, then switch back to npm ci for reproducible builds.
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
