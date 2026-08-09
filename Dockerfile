# --- Stage 1: build the frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend + baked-in static frontend ---
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./app/static

RUN chmod +x entrypoint.sh

ENV DATA_DIR=/data
EXPOSE 8000
CMD ["./entrypoint.sh"]
