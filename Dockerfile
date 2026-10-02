# --- base --------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /driving-game
COPY package.json package-lock.json* ./

# --- dev -----------------------------------------------------------------
# Image utilisée par docker-compose pour le développement local (hot reload).
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- build -----------------------------------------------------------------
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# --- prod --------------------------------------------------------------
# Image statique légère, utile pour tester/déployer le build de prod.
FROM nginx:alpine AS prod
COPY --from=build /driving-game/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
