import tempfile
from datetime import date, timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from votaciones.models import Categoria, Edicion, Opcion, Usuario, Votacion

CLAVE_VOTANTE = "Voto2027*seguro"
CLAVE_ADMIN = "Admin2027*seguro"


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="flv-media-portal-"), CORREO_ADAPTADOR="memoria")
class BasePortalTest(TestCase):
    """Datos mínimos: edición activa 2027 → categoría Música → votación abierta con dos opciones."""

    def setUp(self):
        ahora = timezone.now()
        self.edicion = Edicion.objects.create(
            nombre="Festival de la Leyenda Vallenata 2027", anio=2027,
            fecha_inicio=date(2027, 4, 28), fecha_fin=date(2027, 5, 1),
        )
        self.categoria = Categoria.objects.create(edicion=self.edicion, nombre="Música", descripcion="Canciones", orden=1)
        self.votacion = Votacion.objects.create(
            categoria=self.categoria, titulo="Canción favorita del público", descripcion="Elige tu canción",
            fecha_apertura=ahora - timedelta(days=1), fecha_cierre=ahora + timedelta(days=5), publicada=True,
        )
        self.opcion_a = Opcion.objects.create(votacion=self.votacion, nombre="Canción A", orden=1)
        self.opcion_b = Opcion.objects.create(votacion=self.votacion, nombre="Canción B", orden=2)
        self.votante = Usuario.objects.create_user(
            "votante@festival.test", CLAVE_VOTANTE, nombres="Valentina", apellidos="Prueba",
            acepta_tratamiento_datos=True, correo_verificado=True,
        )
        self.admin = Usuario.objects.create_user(
            "admin@festival.test", CLAVE_ADMIN, nombres="Ana", apellidos="Admin",
            rol=Usuario.Rol.ADMINISTRADOR, acepta_tratamiento_datos=True, correo_verificado=True,
        )

    def entrar_como_admin(self):
        self.client.force_login(self.admin)
