# Muestras de audio

`generar_muestras.py` sintetiza fragmentos instrumentales **originales** (acordeón, caja y guacharaca) para las canciones ficticias de prueba. No usan grabaciones reales, así que no tienen restricciones de derechos de autor.

```bash
pip install numpy scipy
python generar_muestras.py            # genera wav/
# convertir a MP3 (96 kbps, mono) con ffmpeg y copiar a app/web/public/audio/muestras/
```
