from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("votaciones", "0008_dias_visible_cerradas"),
    ]

    operations = [
        migrations.AddField(
            model_name="edicion",
            name="visibilidad_resultados",
            field=models.CharField(
                choices=[("tiempo_real", "En tiempo real"), ("al_cierre", "Al cierre"), ("no_publicar", "No publicar")],
                default="al_cierre", help_text="Cuándo ve el público los resultados de las votaciones de la edición.", max_length=15,
            ),
        ),
        migrations.AddField(
            model_name="votacion",
            name="personalizar_resultados",
            field=models.BooleanField(default=False, help_text="Usar la visibilidad de resultados propia en lugar de la de la edición."),
        ),
    ]
