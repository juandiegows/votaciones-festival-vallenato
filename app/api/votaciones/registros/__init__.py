"""
Registros técnicos (logs): qué falló en el código, dónde (archivo y línea), en qué petición y a quién le pasó.

- `registro.py`: piezas de `logging` que usa settings.LOGGING (contexto de la petición, formato JSON y el manejador
  que guarda los errores en la base de datos para verlos en /panel/registros).
- `middleware.py`: identificador de cada petición (encabezado X-Request-ID) y la línea de acceso con su duración.
- `models.py`: RegistroSistema (tabla registro_sistema).
Es distinto de la auditoría (votaciones/auditoria), que guarda lo que hace la administración, no los errores.
"""
