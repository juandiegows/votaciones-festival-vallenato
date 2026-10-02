# Build estático de Vite servido por nginx (mismo patrón que juandiegows-com-web).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_API_URL vacío = modo de datos simulados; /api = API Django en el mismo dominio
ARG VITE_API_URL=""
ENV VITE_BASE=/ VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
