from datetime import timedelta

from django.utils import timezone

from votaciones.models import Opcion, Voto

from .base import BaseAPITest


class VotarTests(BaseAPITest):
    def votar(self, votacion, opcion):
        return self.client.post(f"/api/votaciones/{votacion.pk}/votar/", {"opcion": opcion.pk}, format="json")

    def test_visitante_no_puede_votar(self):
        self.assertEqual(self.votar(self.abierta, self.opcion_a).status_code, 401)
        self.assertEqual(Voto.objects.count(), 0)

    def test_voto_exitoso_genera_comprobante(self):
        self.autenticar(self.votante)
        respuesta = self.votar(self.abierta, self.opcion_a)
        self.assertEqual(respuesta.status_code, 201)
        self.assertRegex(respuesta.data["codigo_comprobante"], r"^FLV27-[A-Z0-9]{6}$")
        voto = Voto.objects.get()
        self.assertEqual((voto.usuario, voto.opcion), (self.votante, self.opcion_a))

    def test_no_permite_superar_limite_de_votos(self):
        self.autenticar(self.votante)
        self.votar(self.abierta, self.opcion_a)
        respuesta = self.votar(self.abierta, self.opcion_b)
        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(respuesta.data["codigo"], "limite_votos")
        self.assertEqual(Voto.objects.count(), 1)

    def test_limite_configurable(self):
        self.abierta.votos_por_usuario = 2
        self.abierta.personalizar_votos = True
        self.abierta.save()
        self.autenticar(self.votante)
        self.assertEqual(self.votar(self.abierta, self.opcion_a).status_code, 201)
        self.assertEqual(self.votar(self.abierta, self.opcion_b).status_code, 201)
        self.assertEqual(self.votar(self.abierta, self.opcion_a).status_code, 409)

    def test_votacion_programada_rechaza_voto(self):
        ahora = timezone.now()
        futura = self.crear_votacion("Futura", ahora + timedelta(days=1), ahora + timedelta(days=3))
        opcion = Opcion.objects.create(votacion=futura, nombre="X")
        self.autenticar(self.votante)
        respuesta = self.votar(futura, opcion)
        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(respuesta.data["codigo"], "votacion_no_abierta")

    def test_votacion_cerrada_rechaza_voto(self):
        self.abierta.cerrada_manualmente = True
        self.abierta.save()
        self.autenticar(self.votante)
        self.assertEqual(self.votar(self.abierta, self.opcion_a).status_code, 409)

    def test_opcion_de_otra_votacion_es_invalida(self):
        ahora = timezone.now()
        otra = self.crear_votacion("Otra", ahora - timedelta(days=1), ahora + timedelta(days=1))
        ajena = Opcion.objects.create(votacion=otra, nombre="Ajena")
        self.autenticar(self.votante)
        respuesta = self.votar(self.abierta, ajena)
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["codigo"], "opcion_invalida")

    def test_opcion_inactiva_es_invalida(self):
        self.opcion_a.activa = False
        self.opcion_a.save()
        self.autenticar(self.votante)
        self.assertEqual(self.votar(self.abierta, self.opcion_a).status_code, 400)

    def test_votacion_borrador_no_existe_para_el_publico(self):
        ahora = timezone.now()
        borrador = self.crear_votacion("Borrador", ahora - timedelta(days=1), ahora + timedelta(days=1), publicada=False)
        opcion = Opcion.objects.create(votacion=borrador, nombre="X")
        self.autenticar(self.votante)
        self.assertEqual(self.votar(borrador, opcion).status_code, 404)

    def test_mis_votos_y_detalle_reflejan_el_voto(self):
        self.autenticar(self.votante)
        self.votar(self.abierta, self.opcion_a)
        mis_votos = self.client.get("/api/mis-votos/").data
        self.assertEqual(len(mis_votos), 1)
        self.assertEqual(mis_votos[0]["opcion_nombre"], "Canción A")
        self.assertEqual(self.client.get(f"/api/votaciones/{self.abierta.pk}/").data["mis_votos"], 1)

    def test_votante_no_ve_votos_de_otros(self):
        Voto.objects.create(usuario=self.admin, votacion=self.abierta, opcion=self.opcion_b, codigo_comprobante="FLV27-BBBBBB")
        self.autenticar(self.votante)
        self.assertEqual(self.client.get("/api/mis-votos/").data, [])
