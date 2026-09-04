FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY gateway ./gateway
COPY core ./core
COPY tools ./tools
COPY llm ./llm
COPY config ./config
COPY capabilities ./capabilities
COPY skills ./skills
COPY cli ./cli

RUN npm run build

ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

CMD ["node", "dist/gateway/studio.js"]
