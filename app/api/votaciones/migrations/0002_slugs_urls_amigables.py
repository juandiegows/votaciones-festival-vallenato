"""Slugs para URL amigables (/{año}/{categoría}/{votación}) y enlaces multimedia relativos.

1. Agrega `slug` a Categoria y Votacion.
2. Llena los slugs de las filas existentes (sin tildes, únicos dentro de la edición o la categoría).
3. Crea las restricciones de unicidad.
4. `Opcion.enlace_multimedia` pasa a texto: URL absoluta http(s) o ruta del sitio (p. ej. /audio/muestras/x.mp3).
"""
from django.db import migrations, models
from django.utils.text import slugify


def _unico(usados, texto, max_length):
    base = (slugify(texto) or "item")[:max_length].strip("-")
    candidato, n = base, 2
    while candidato in usados:
        sufijo = f"-{n}"
        candidato = f"{base[: max_length - len(sufijo)]}{sufijo}"
        n += 1
    usados.add(candidato)
    return candidato


def llenar_slugs(apps, schema_editor):
    Categoria = apps.get_model("votaciones", "Categoria")
    Votacion = apps.get_model("votaciones", "Votacion")

    por_edicion = {}
    for categoria in Categoria.objects.order_by("id"):
        categoria.slug = _unico(por_edicion.setdefault(categoria.edicion_id, set()), categoria.nombre, 120)
        categoria.save(update_fields=["slug"])

    por_categoria = {}
    for votacion in Votacion.objects.order_by("id"):
        votacion.slug = _unico(por_categoria.setdefault(votacion.categoria_id, set()), votacion.titulo, 150)
        votacion.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("votaciones", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="categoria",
            name="slug",
            field=models.SlugField(
                blank=True, max_length=120,
                help_text="Identificador para la URL pública; se genera desde el nombre si se deja vacío.",
            ),
        ),
        migrations.AddField(
            model_name="votacion",
            name="slug",
            field=models.SlugField(
                blank=True, max_length=150,
                help_text="Identificador para la URL pública; se genera desde el título si se deja vacío.",
            ),
        ),
        migrations.RunPython(llenar_slugs, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="categoria",
            constraint=models.UniqueConstraint(fields=("edicion", "slug"), name="categoria_slug_unico_por_edicion"),
        ),
        migrations.AddConstraint(
            model_name="votacion",
            constraint=models.UniqueConstraint(fields=("categoria", "slug"), name="votacion_slug_unico_por_categoria"),
        ),
        migrations.AlterField(
            model_name="opcion",
            name="enlace_multimedia",
            field=models.CharField(
                blank=True, max_length=300,
                help_text="URL absoluta http(s) o ruta del sitio que empieza por «/» (p. ej. /audio/muestras/x.mp3).",
            ),
        ),
    ]
