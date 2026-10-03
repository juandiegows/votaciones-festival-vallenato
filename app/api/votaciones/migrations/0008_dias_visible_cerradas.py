from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("votaciones", "0007_revista"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionsitio",
            name="dias_visible_cerradas",
            field=models.PositiveSmallIntegerField(
                default=7, help_text="Días que una votación cerrada sigue visible en el sitio público (0 = se oculta al cerrar)."
            ),
        ),
    ]
