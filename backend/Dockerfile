# Imagen del backend. Build en dos etapas.
#
# La etapa de dependencias instala con npm ci, que respeta el
# package-lock.json exacto. npm install podria traer versiones distintas a
# las que se probaron, que es justo lo que el inventario tecnologico del
# punto 1 intenta evitar.

FROM node:24-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
# --omit=dev deja fuera nodemon y companía: no van a la imagen final.
RUN npm ci --omit=dev


FROM node:24-alpine AS runtime

# dumb-init como PID 1: Node no reenvia SIGTERM a sus hijos y sin esto el
# contenedor tarda 10 segundos en morir en cada docker compose down.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

# Usuario sin privilegios. La imagen de Node ya trae el usuario "node";
# correr como root dentro del contenedor es innecesario y es un hallazgo
# clasico de cualquier escaneo de seguridad.
USER node

EXPOSE 3000

# El .env NO va dentro de la imagen: las variables se inyectan al correr.
# Una imagen con secretos adentro es una imagen que no se puede publicar.

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/productos').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
