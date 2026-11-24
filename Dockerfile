# Production image: builds the static frontend and runs server.js (Express)
# to serve it plus the Postgres-backed API, on the port Railway assigns via
# $PORT. This is an alternative to Railway's default Nixpacks build — only
# needed if you switch the service to "Dockerfile" build mode; Nixpacks
# (npm install && npm run build, start command `npm start`) works fine
# without this file too.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist

EXPOSE 8787
CMD ["npm", "start"]
