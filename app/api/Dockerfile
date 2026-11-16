FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Parches de seguridad de Debian (apt, zlib...) sobre la base publicada; reintenta si el mirror falla
RUN for i in 1 2 3; do \
      apt-get update && apt-get upgrade -y && ok=1 && break; \
      echo "apt-get fallo (intento $i), reintentando..."; sleep 5; \
    done; \
    [ "$ok" = 1 ] && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh \
    && useradd --create-home --uid 1000 app && mkdir -p /app/media && chown -R app /app
USER app

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
