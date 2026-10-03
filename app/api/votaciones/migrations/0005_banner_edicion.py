"""Cada banner del inicio pertenece a una edición; los existentes pasan a la edición activa."""
import django.db.models.deletion
from django.db import migrations, models


def asignar_edicion_activa(apps, schema_editor):
    Edicion = apps.get_model("votaciones", "Edicion")
    BannerInicio = apps.get_model("votaciones", "BannerInicio")
    if not BannerInicio.objects.exists():
        return
    edicion = Edicion.objects.filter(estado="activa").order_by("-anio").first() or Edicion.objects.order_by("-anio").first()
    if edicion is None:  # sin ediciones no hay a quién asignarlos
        BannerInicio.objects.all().delete()
        return
    BannerInicio.objects.update(edicion=edicion)


class Migration(migrations.Migration):

    dependencies = [
        ("votaciones", "0004_presentaciones_iconos_audio"),
    ]

    operations = [
        migrations.AddField(
            model_name="bannerinicio",
            name="edicion",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.PROTECT, related_name="banners", to="votaciones.edicion"
            ),
        ),
        migrations.RunPython(asignar_edicion_activa, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="bannerinicio",
            name="edicion",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, related_name="banners", to="votaciones.edicion"
            ),
        ),
        migrations.AlterModelOptions(
            name="bannerinicio",
            options={"ordering": ["edicion", "orden", "id"], "verbose_name": "banner de inicio", "verbose_name_plural": "banners de inicio"},
        ),
    ]
