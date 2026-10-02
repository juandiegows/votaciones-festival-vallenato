#!/bin/sh
set -e

if [ "$DB_ENGINE" = "mysql" ]; then
  echo "Esperando a MySQL en $DB_HOST:$DB_PORT..."
  until python -c "import os,pymysql; pymysql.connect(host=os.environ['DB_HOST'], port=int(os.environ.get('DB_PORT','3306')), user=os.environ['DB_USER'], password=os.environ.get('DB_PASSWORD',''), database=os.environ['DB_NAME'])" 2>/dev/null; do
    sleep 2
  done
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput >/dev/null

exec "$@"
