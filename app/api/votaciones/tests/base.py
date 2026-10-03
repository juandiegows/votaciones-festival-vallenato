import tempfile
from datetime import date, timedelta

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from votaciones.models import Categoria, Edicion, Opcion, Usuario, Votacion


# Los archivos subidos en las pruebas van a una carpeta temporal
@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="flv-media-pruebas-"))
class BaseAPITest(APITestCase):
    def setUp(self):
        cache.clear()
        ahora = timezone.now()
        self.edicion = Edicion.objects.create(
            nombre="Festival de la Leyenda Vallenata 2027", anio=2027,
            fecha_inicio=date(2027, 4, 28), fecha_fin=date(2027, 5, 1),
        )
        self.categoria = Categoria.objects.create(edicion=self.edicion, nombre="Música", orden=1)
        self.abierta = self.crear_votacion("Canción favorita del público", ahora - timedelta(days=1), ahora + timedelta(days=5))
        self.opcion_a = Opcion.objects.create(votacion=self.abierta, nombre="Canción A", orden=1)
        self.opcion_b = Opcion.objects.create(votacion=self.abierta, nombre="Canción B", orden=2)

        self.votante = Usuario.objects.create_user(
            "votante@festival.test", "Voto2027*seguro", nombres="Valentina", apellidos="Prueba",
            acepta_tratamiento_datos=True, correo_verificado=True, tipo_documento="CC", numero_documento="1065000001",
        )
        self.admin = Usuario.objects.create_user(
            "admin@festival.test", "Admin2027*seguro", nombres="Ana", apellidos="Admin",
            rol=Usuario.Rol.ADMINISTRADOR, acepta_tratamiento_datos=True, correo_verificado=True,
        )

    def crear_votacion(self, titulo, apertura, cierre, publicada=True, **extra):
        return Votacion.objects.create(
            categoria=self.categoria, titulo=titulo, fecha_apertura=apertura, fecha_cierre=cierre,
            publicada=publicada, **extra,
        )

    def autenticar(self, usuario):
        token, _ = Token.objects.get_or_create(user=usuario)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def salir(self):
        self.client.credentials()
