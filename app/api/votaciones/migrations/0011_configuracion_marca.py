from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("votaciones", "0010_dias_visible_cerradas_siempre"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionsitio",
            name="marca",
            field=models.JSONField(blank=True, default=dict, help_text="Colores y estilos de botón personalizados del sitio."),
        ),
    ]
