# Entrega 3 · RN-04: un voto por usuario, categoría y edición, exigido también por MySQL.

import django.db.models.deletion
from django.db import migrations, models


def completar_ambito_y_depurar(apps, schema_editor):
    """Copia categoría y edición de la votación a cada voto y deja solo el primer voto de cada usuario por categoría.

    Antes de esta entrega el límite era por votación (configurable); los votos repetidos en otra votación de la
    misma categoría (datos de demostración) violarían la nueva restricción y se descartan, conservando el más antiguo.
    """
    Voto = apps.get_model("votaciones", "Voto")
    vistos = set()
    sobrantes = []
    for voto in Voto.objects.select_related("votacion__categoria").order_by("fecha_hora", "id").iterator():
        categoria = voto.votacion.categoria
        clave = (voto.usuario_id, categoria.pk, categoria.edicion_id)
        if clave in vistos:
            sobrantes.append(voto.pk)
            continue
        vistos.add(clave)
        Voto.objects.filter(pk=voto.pk).update(categoria_id=categoria.pk, edicion_id=categoria.edicion_id)
    for inicio in range(0, len(sobrantes), 500):
        Voto.objects.filter(pk__in=sobrantes[inicio:inicio + 500]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("votaciones", "0003_presentaciones_colores_respuestas_duelo"),
    ]

    operations = [
        migrations.AddField(
            model_name="voto",
            name="edicion",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.PROTECT, related_name="votos", to="votaciones.edicion"
            ),
        ),
        migrations.AddField(
            model_name="voto",
            name="categoria",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.PROTECT, related_name="votos", to="votaciones.categoria"
            ),
        ),
        migrations.RunPython(completar_ambito_y_depurar, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="voto",
            name="edicion",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, related_name="votos", to="votaciones.edicion"
            ),
        ),
        migrations.AlterField(
            model_name="voto",
            name="categoria",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, related_name="votos", to="votaciones.categoria"
            ),
        ),
        migrations.AddConstraint(
            model_name="voto",
            constraint=models.UniqueConstraint(
                fields=("usuario", "categoria", "edicion"), name="voto_unico_usuario_categoria_edicion"
            ),
        ),
    ]
