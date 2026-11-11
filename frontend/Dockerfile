# Imagen del frontend. Build en dos etapas.
#
# La primera compila con Angular; la segunda sirve el resultado estatico con
# nginx. Node no queda en la imagen final: pasa de ~1,2 GB a unos 60 MB, y
# saca de circulacion todas las dependencias de desarrollo.
#
# Nunca se usa "ng serve" para servir: es un servidor de desarrollo, sin
# compresion ni cache, y no esta pensado para recibir trafico.

FROM node:24-alpine AS build

# Evita que el CLI pregunte por consentimiento de analiticas, que bloquea la
# compilacion esperando una respuesta que en un build no llega nunca.
ENV NG_CLI_ANALYTICS=false
ENV CI=true

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# La configuracion de produccion reemplaza environment.ts por
# environment.production.ts, donde la URL de la API es relativa.
RUN npx ng build --configuration production


# nginx 1.29. Se subio desde 1.27 por el escaneo del punto 14: la imagen de
# 1.27 arrastraba 3 vulnerabilidades criticas y 64 altas de su propio Alpine
# (brotli, curl, c-ares...), ninguna del codigo de este proyecto.
FROM nginx:1.29-alpine AS runtime

# Parches del sistema base. Fijar la etiqueta (nginx:1.29-alpine) da
# reproducibilidad, pero NO da parches: la etiqueta se reconstruye cuando el
# que la publica quiere, y mientras tanto arrastra las vulnerabilidades que
# Alpine ya corrigio en su repositorio. El escaneo del 11/11 lo mostro:
# 1 CRITICA y 56 ALTAS, ninguna del codigo de este proyecto y TODAS con
# parche disponible (brotli 1.2.0-r0 -> 1.2.1-r0, c-ares, curl...).
# Esta linea toma esos parches en cada construccion.
RUN apk --no-cache upgrade

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/proyfrontendgrupo13/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1
