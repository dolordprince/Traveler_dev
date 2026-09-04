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
FROM python:3.10-slim
# Install Node.js for building frontend assets
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
# Copy and install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
# Copy and build frontend assets
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm install && npm run build
# Move back to root and copy app source files
COPY backend/ ./backend/
# Create a startup script to run FastAPI bound to Hugging Face port 7860
cat << 'EOT' > start.sh
cd /app/backend
uvicorn main:app --host 0.0.0.0 --port 7860
EOT
chmod +x start.sh
CMD ["./start.sh"]
