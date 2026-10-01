FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
RUN apk add --no-cache su-exec
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 DATA_DIR=/data STATIC_DIR=/app/public BACKUP_DIR=/backups
COPY --from=build /app/dist/client ./public
COPY server/ ./server/
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod 755 /app/docker-entrypoint.sh && mkdir -p /data && chown node:node /data
VOLUME ["/data", "/backups"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/app/docker-entrypoint.sh"]
