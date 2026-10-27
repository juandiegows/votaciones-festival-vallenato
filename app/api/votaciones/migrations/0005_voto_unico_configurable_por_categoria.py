# Entrega 3 · RN-04 configurable: «Un solo voto en toda la categoría» (marcado por defecto) o un voto por votación.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('votaciones', '0004_voto_unico_por_categoria_edicion'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='voto',
            name='voto_unico_usuario_categoria_edicion',
        ),
        migrations.AddField(
            model_name='categoria',
            name='voto_unico',
            field=models.BooleanField(default=True, help_text='Marcado: cada persona vota una sola vez en la categoría, aunque tenga varias votaciones. Desmarcado: puede votar una vez en cada votación. No se puede cambiar cuando la categoría ya tiene votos.', verbose_name='un solo voto en toda la categoría'),
        ),
        migrations.AddField(
            model_name='voto',
            name='ambito_votacion',
            field=models.PositiveIntegerField(default=0, editable=False),
        ),
        migrations.AddConstraint(
            model_name='voto',
            constraint=models.UniqueConstraint(fields=('usuario', 'categoria', 'edicion', 'ambito_votacion'), name='voto_unico_usuario_categoria_edicion'),
        ),
    ]
