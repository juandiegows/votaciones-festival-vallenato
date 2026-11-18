-- =====================================================================
-- Consultas para la sustentación (Eje 4) · Votaciones FLV 2027
-- Base: votaciones_flv (MySQL) · todas son de solo lectura, salvo la 9,
-- que intenta un INSERT duplicado y MySQL lo RECHAZA (no cambia nada).
--
-- Consola local (Docker):
--   docker compose exec db mysql --default-character-set=utf8mb4 -uvotaciones -p votaciones_flv
-- Las fechas se guardan en UTC (hora de Colombia = UTC − 5).
-- =====================================================================


-- 1. El voto que María acaba de emitir (primera fila = el más reciente)
SELECT codigo_comprobante, votacion_id, opcion_id, fecha_hora
FROM voto
ORDER BY fecha_hora DESC
LIMIT 3;


-- 2. Las tablas que creó Django con las migraciones (Modelo → tabla)
SHOW TABLES;


-- 3. La restricción única que impide el doble voto (respaldo de Django en MySQL)
--    Non_unique = 0 → índice único sobre usuario + categoría + edición + ámbito
SHOW INDEX FROM voto WHERE Key_name = 'voto_unico_usuario_categoria_edicion';


-- 4. La jerarquía completa: Edición → Categoría → Votación → nº de opciones y votos
SELECT e.anio,
       c.nombre                   AS categoria,
       v.titulo                   AS votacion,
       COUNT(DISTINCT o.id)       AS opciones,
       COUNT(DISTINCT vo.id)      AS votos
FROM edicion e
JOIN categoria c   ON c.edicion_id  = e.id
JOIN votacion v    ON v.categoria_id = c.id
LEFT JOIN opcion o ON o.votacion_id  = v.id
LEFT JOIN voto vo  ON vo.votacion_id = v.id
WHERE e.anio = 2027
GROUP BY e.anio, c.nombre, v.titulo
ORDER BY c.nombre, v.titulo;


-- 5. Resultados de «Mejor parranda vallenata»: votos y porcentaje por opción
--    (lo mismo que calcula calcular_resultados() en reportes.py)
SELECT o.nombre AS opcion,
       COUNT(vo.id) AS votos,
       ROUND(100 * COUNT(vo.id) / SUM(COUNT(vo.id)) OVER (), 1) AS porcentaje
FROM opcion o
JOIN votacion v   ON v.id = o.votacion_id
LEFT JOIN voto vo ON vo.opcion_id = o.id
WHERE v.titulo = 'Mejor parranda vallenata'
GROUP BY o.id, o.nombre
ORDER BY votos DESC;


-- 6. Ganador actual de cada votación de 2027
SELECT categoria, votacion, opcion AS va_ganando, votos
FROM (
    SELECT c.nombre AS categoria, v.titulo AS votacion, o.nombre AS opcion,
           COUNT(vo.id) AS votos,
           RANK() OVER (PARTITION BY v.id ORDER BY COUNT(vo.id) DESC) AS puesto
    FROM votacion v
    JOIN categoria c  ON c.id = v.categoria_id
    JOIN edicion e    ON e.id = c.edicion_id
    JOIN opcion o     ON o.votacion_id = v.id
    LEFT JOIN voto vo ON vo.opcion_id = o.id
    WHERE e.anio = 2027
    GROUP BY c.nombre, v.id, v.titulo, o.id, o.nombre
) t
WHERE puesto = 1 AND votos > 0
ORDER BY votos DESC;


-- 7. Estado de cada votación (lo mismo que calcula Votacion.estado_en())
SELECT v.titulo,
       CASE
         WHEN v.publicada = 0                      THEN 'borrador'
         WHEN v.cerrada_manualmente = 1            THEN 'cerrada'
         WHEN NOW() <  v.fecha_apertura            THEN 'programada'
         WHEN NOW() >  v.fecha_cierre              THEN 'cerrada'
         ELSE 'abierta'
       END AS estado,
       v.fecha_apertura, v.fecha_cierre
FROM votacion v
JOIN categoria c ON c.id = v.categoria_id
JOIN edicion e   ON e.id = c.edicion_id
WHERE e.anio = 2027
ORDER BY estado, v.titulo;


-- 8. Comprobar la regla: nadie tiene dos votos en la misma categoría
--    (resultado vacío = la regla se cumple en toda la base)
SELECT usuario_id, categoria_id, edicion_id, ambito_votacion, COUNT(*) AS votos
FROM voto
GROUP BY usuario_id, categoria_id, edicion_id, ambito_votacion
HAVING COUNT(*) > 1;


-- 9. Prueba en vivo: intentar duplicar el último voto directamente en MySQL.
--    Debe fallar con: ERROR 1062 (23000): Duplicate entry ... for key
--    'voto.voto_unico_usuario_categoria_edicion'  →  la base no acepta el doble voto
INSERT INTO voto (fecha_hora, codigo_comprobante, ip, opcion_id, usuario_id,
                  votacion_id, edicion_id, categoria_id, ambito_votacion)
SELECT NOW(6), 'FLV27-PRUEBA', ip, opcion_id, usuario_id,
       votacion_id, edicion_id, categoria_id, ambito_votacion
FROM voto
ORDER BY fecha_hora DESC
LIMIT 1;


-- 10. Participación por categoría (cuántas personas votaron; voto secreto:
--     se cuenta quién participó, nunca por quién votó)
SELECT c.nombre AS categoria,
       COUNT(DISTINCT vo.usuario_id) AS votantes,
       COUNT(vo.id)                  AS votos
FROM categoria c
JOIN edicion e    ON e.id = c.edicion_id
LEFT JOIN voto vo ON vo.categoria_id = c.id
WHERE e.anio = 2027
GROUP BY c.id, c.nombre
ORDER BY votos DESC;


-- 11. Usuarios por rol y cuántos confirmaron el correo
SELECT rol,
       COUNT(*)                 AS usuarios,
       SUM(correo_verificado)   AS correo_confirmado
FROM usuario
GROUP BY rol;


-- 12. Votos por día (actividad de la votación)
SELECT DATE(fecha_hora) AS dia, COUNT(*) AS votos
FROM voto
GROUP BY DATE(fecha_hora)
ORDER BY dia DESC
LIMIT 10;
