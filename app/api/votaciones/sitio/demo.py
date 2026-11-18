"""
Datos de demostración (los que crea `python manage.py cargar_demo`): saber si una cuenta es de demostración, impedir su
ingreso cuando la configuración lo apaga, y eliminarlos o volver a cargarlos desde el panel.

Para no dejar el sistema sin administración, apagar las cuentas demo y eliminar o recargar los datos exigen que quien
lo hace sea un administrador propio (no de demostración) y que exista al menos uno activo.
"""

import io

from django.contrib.auth.backends import ModelBackend
from django.core.management import call_command
from django.db import transaction

from ..comun.errores import ReglaNegocioError
from ..votacion.models import Edicion, Voto
from .models import ConfiguracionSitio

CORREOS_DEMO = ("admin@festival.test", "votante@festival.test")
DOMINIO_DEMO = "@demo.festival.test"
ANIOS_DEMO = (2025, 2026, 2027)


def es_cuenta_demo(correo):
    correo = (correo or "").strip().lower()
    return correo in CORREOS_DEMO or correo.endswith(DOMINIO_DEMO)


def usuarios_demo():
    from ..cuentas.models import Usuario

    return Usuario.objects.filter(email__in=CORREOS_DEMO) | Usuario.objects.filter(email__endswith=DOMINIO_DEMO)


def cuentas_demo_permitidas():
    # Solo se lee (sin crear el registro): la autenticación corre al cargar cada sesión
    valor = ConfiguracionSitio.objects.filter(pk=1).values_list("permitir_cuentas_demo", flat=True).first()
    return True if valor is None else valor


class AutenticacionConCuentasDemo(ModelBackend):
    """Igual que el de Django, pero las cuentas de demostración no entran si la configuración lo apaga."""

    def user_can_authenticate(self, user):
        if es_cuenta_demo(getattr(user, "email", "")) and not cuentas_demo_permitidas():
            return False
        return super().user_can_authenticate(user)


def validar_administrador_propio(usuario, accion):
    """Lanza ReglaNegocioError si `usuario` es de demostración o no hay otro administrador activo que no lo sea."""
    from ..cuentas.models import Usuario

    if es_cuenta_demo(usuario.email):
        raise ReglaNegocioError(
            f"Para {accion} inicia sesión con una cuenta de administrador propia: con una cuenta de demostración "
            "quedarías sin acceso al panel."
        )
    propios = Usuario.objects.filter(rol=Usuario.Rol.ADMINISTRADOR, is_active=True).exclude(pk__in=usuarios_demo())
    if not propios.exists():
        raise ReglaNegocioError(f"Para {accion} debe existir al menos un administrador activo que no sea de demostración.")


def resumen():
    ediciones = Edicion.objects.filter(anio__in=ANIOS_DEMO)
    return {
        "ediciones": ediciones.count(),
        "usuarios": usuarios_demo().count(),
        "votos": Voto.objects.filter(votacion__categoria__edicion__in=ediciones).count(),
        "permitir_cuentas_demo": cuentas_demo_permitidas(),
    }


class _ConservarSitio:
    """El comando de demostración reinicia el contacto, las redes y la configuración: aquí se conservan como estaban."""

    def __enter__(self):
        from .models import RedSocial

        configuracion = ConfiguracionSitio.obtener()
        self.datos = {c.attname: getattr(configuracion, c.attname) for c in ConfiguracionSitio._meta.concrete_fields if c.attname != "id"}
        self.redes = list(RedSocial.objects.values())
        return self

    def __exit__(self, tipo, *_):
        from .models import RedSocial

        if tipo is None:
            from ..cuentas.models import Usuario

            existentes = set(Usuario.objects.values_list("pk", flat=True))

            def sin_autores_borrados(datos):
                # creado_por / actualizado_por de cuentas demo ya eliminadas quedan vacíos
                return {k: (None if k.endswith("_por_id") and v not in existentes else v) for k, v in datos.items()}

            ConfiguracionSitio.objects.update_or_create(pk=1, defaults=sin_autores_borrados(self.datos))
            RedSocial.objects.all().delete()
            for red in self.redes:
                RedSocial.objects.create(**sin_autores_borrados(red))
        return False


@transaction.atomic
def eliminar(usuario):
    """Borra las ediciones, votos, banners y cuentas de demostración. Conserva el contacto, las redes y la configuración."""
    from ..management.commands.cargar_demo import Command

    validar_administrador_propio(usuario, "eliminar los datos de demostración")
    antes = resumen()
    with _ConservarSitio():
        Command().borrar(list(ANIOS_DEMO))
    return antes


@transaction.atomic
def cargar(usuario):
    """Vuelve a crear los datos de demostración (borra los anteriores). Devuelve el mensaje del comando."""
    validar_administrador_propio(usuario, "volver a cargar los datos de demostración")
    salida = io.StringIO()
    try:
        with _ConservarSitio():
            call_command("cargar_demo", reiniciar=True, stdout=salida)
    except ReglaNegocioError:
        raise
    except Exception as error:  # noqa: BLE001 — p. ej. faltan DEMO_CLAVE_* en el servidor
        raise ReglaNegocioError(f"No fue posible cargar los datos de demostración: {error}") from None
    return salida.getvalue().strip()
