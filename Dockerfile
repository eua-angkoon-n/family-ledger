FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY web ./web
RUN npm run build

FROM node:22-bookworm-slim
# qpdf ถอดรหัส PDF (ต้อง >= 10.2 สำหรับ --password-file, bookworm ให้ 11.x)
# poppler-utils ให้ pdftotext
RUN apt-get update \
 && apt-get install -y --no-install-recommends -o Acquire::Retries=3 qpdf poppler-utils \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY migrations ./migrations
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
USER node
CMD ["node", "dist/server.js"]
