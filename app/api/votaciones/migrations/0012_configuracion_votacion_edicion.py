from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("votaciones", "0011_configuracion_marca"),
    ]

    operations = [
        migrations.AddField(
            model_name="edicion",
            name="votos_por_usuario",
            field=models.PositiveSmallIntegerField(default=1, help_text="Votos por usuario en cada votación de la edición."),
        ),
        migrations.AddField(
            model_name="edicion",
            name="votaciones_pausadas",
            field=models.BooleanField(default=False, help_text="Suspende temporalmente la recepción de votos de la edición."),
        ),
        migrations.AddField(
            model_name="votacion",
            name="personalizar_votos",
            field=models.BooleanField(default=False, help_text="Usar el límite de votos propio en lugar del de la edición."),
        ),
        migrations.AddField(
            model_name="configuracionsitio",
            name="mostrar_total_votos",
            field=models.BooleanField(default=False, help_text="Mostrar al público el total de votos en el inicio."),
        ),
    ]
