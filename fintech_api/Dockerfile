# Dockerfile
# Multi-stage build: lean production image using Python 3.12-slim

FROM python:3.12-slim AS base

# System dependencies for asyncpg (libpq) and cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Dependency layer (cached unless requirements.txt changes) ─────────────────
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Final image ───────────────────────────────────────────────────────────────
FROM deps AS final
COPY . .

# Non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
