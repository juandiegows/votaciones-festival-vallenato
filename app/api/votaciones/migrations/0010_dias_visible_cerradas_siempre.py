from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("votaciones", "0009_visibilidad_resultados_por_edicion"),
    ]

    operations = [
        migrations.AlterField(
            model_name="configuracionsitio",
            name="dias_visible_cerradas",
            field=models.PositiveSmallIntegerField(
                blank=True, default=7, null=True,
                help_text="Días que una votación cerrada sigue visible en el sitio público (0 = se oculta al cerrar; vacío = siempre visible).",
            ),
        ),
    ]
