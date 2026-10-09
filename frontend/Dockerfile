# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# default.conf.template is rendered by the image's entrypoint; restrict envsubst to our two variables

ENV NGINX_ENVSUBST_FILTER="OSRM_"

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/config.js.template /etc/rideshare/config.js.template
COPY docker/40-render-config.sh /docker-entrypoint.d/40-render-config.sh
RUN chmod +x /docker-entrypoint.d/40-render-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
