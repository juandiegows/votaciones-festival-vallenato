from unittest import mock

from django.urls import reverse

from votaciones.models import Usuario, Voto
from votaciones.sitio.models import ConfiguracionSitio

from .base import CLAVE_VOTANTE, BasePortalTest

URL_VOTACION = "/2027/categorias/musica/cancion-favorita-del-publico"


class VotarTest(BasePortalTest):
    def votar(self, opcion):
        return self.client.post(f"{URL_VOTACION}/votar", {"opcion": opcion.pk if opcion else ""})

    def test_voto_exitoso_redirige_al_comprobante_y_envia_el_correo(self):
        self.client.force_login(self.votante)
        with mock.patch("votaciones.correo.enviar_comprobante_voto") as enviar, \
                self.captureOnCommitCallbacks(execute=True):
            respuesta = self.votar(self.opcion_a)
        self.assertRedirects(respuesta, f"{URL_VOTACION}/comprobante")
        voto = Voto.objects.get()
        self.assertEqual((voto.usuario, voto.opcion), (self.votante, self.opcion_a))
        enviar.assert_called_once()
        self.assertEqual(enviar.call_args.args[0], voto)

    def test_comprobante_muestra_el_codigo(self):
        self.client.force_login(self.votante)
        self.votar(self.opcion_a)
        respuesta = self.client.get(f"{URL_VOTACION}/comprobante")
        self.assertContains(respuesta, Voto.objects.get().codigo_comprobante)
        self.assertContains(respuesta, "Canción A")

    def test_sin_sesion_lleva_al_login_con_la_opcion_guardada(self):
        respuesta = self.votar(self.opcion_b)
        self.assertEqual(respuesta.status_code, 302)
        self.assertTrue(respuesta.url.startswith("/login?next="))
        self.assertIn(f"opcion%3D{self.opcion_b.pk}", respuesta.url)
        self.assertEqual(Voto.objects.count(), 0)

    def test_la_opcion_guardada_queda_marcada(self):
        respuesta = self.client.get(f"{URL_VOTACION}?opcion={self.opcion_b.pk}")
        self.assertContains(respuesta, f'value="{self.opcion_b.pk}" data-nombre="Canción B" checked')

    def test_sin_opcion_no_vota(self):
        self.client.force_login(self.votante)
        respuesta = self.votar(None)
        self.assertRedirects(respuesta, URL_VOTACION)
        self.assertEqual(Voto.objects.count(), 0)

    def test_correo_sin_confirmar_no_puede_votar(self):
        self.votante.correo_verificado = False
        self.votante.save()
        self.client.force_login(self.votante)
        respuesta = self.votar(self.opcion_a)
        self.assertEqual(Voto.objects.count(), 0)
        self.assertContains(self.client.get(respuesta.url), "Confirma tu correo para poder votar")

    def test_no_permite_votar_dos_veces(self):
        self.client.force_login(self.votante)
        self.votar(self.opcion_a)
        self.votar(self.opcion_b)
        self.assertEqual(Voto.objects.count(), 1)
        respuesta = self.client.get(URL_VOTACION)
        self.assertContains(respuesta, "Ya votaste en esta votación")
        self.assertNotContains(respuesta, 'id="form-voto"')

    def test_documento_requerido_pide_completarlo_y_luego_vota(self):
        configuracion = ConfiguracionSitio.obtener()
        configuracion.pedir_documento = True
        configuracion.save()
        self.client.force_login(self.votante)
        respuesta = self.votar(self.opcion_a)
        self.assertTrue(respuesta.url.startswith(reverse("portal:completar-documento")))
        self.assertEqual(Voto.objects.count(), 0)
        destino = f"{URL_VOTACION}?opcion={self.opcion_a.pk}"
        respuesta = self.client.post(reverse("portal:completar-documento"), {
            "tipo_documento": "CC", "numero_documento": "1.065.123.456", "next": destino,
        })
        self.assertRedirects(respuesta, destino)
        self.votante.refresh_from_db()
        self.assertEqual(self.votante.numero_documento, "1065123456")
        self.votar(self.opcion_a)
        self.assertEqual(Voto.objects.count(), 1)


class MisVotosTest(BasePortalTest):
    def test_lista_los_votos_con_su_comprobante(self):
        self.client.force_login(self.votante)
        self.client.post(f"{URL_VOTACION}/votar", {"opcion": self.opcion_a.pk})
        respuesta = self.client.get("/mis-votos")
        self.assertContains(respuesta, Voto.objects.get().codigo_comprobante)
        self.assertContains(respuesta, f"{URL_VOTACION}/comprobante")

    def test_requiere_sesion(self):
        self.assertRedirects(self.client.get("/mis-votos"), "/login?next=/mis-votos")


class RecuperarClaveTest(BasePortalTest):
    def test_envia_el_enlace_y_permite_cambiar_la_clave(self):
        with mock.patch("votaciones.correo.enviar_restablecer_clave") as enviar, \
                self.captureOnCommitCallbacks(execute=True):
            respuesta = self.client.post("/recuperar-clave", {"email": "Votante@Festival.test"})
        self.assertContains(respuesta, "Revisa tu correo")
        usuario, enlace = enviar.call_args.args
        self.assertEqual(usuario, self.votante)
        self.assertEqual(enviar.call_args.kwargs["minutos_validez"], 60)
        # El enlace del correo lleva al formulario de la nueva contraseña
        ruta = enlace.split("://", 1)[1].split("/", 1)[1]
        formulario = self.client.get(f"/{ruta}", follow=True)
        self.assertContains(formulario, "Crea tu nueva contraseña")
        nueva = "Acordeon2027*nueva"
        respuesta = self.client.post(formulario.redirect_chain[-1][0], {"new_password1": nueva, "new_password2": nueva})
        self.assertRedirects(respuesta, "/login")
        self.assertTrue(Usuario.objects.get(pk=self.votante.pk).check_password(nueva))

    def test_correo_inexistente_responde_igual_sin_enviar(self):
        with mock.patch("votaciones.correo.enviar_restablecer_clave") as enviar, \
                self.captureOnCommitCallbacks(execute=True):
            respuesta = self.client.post("/recuperar-clave", {"email": "nadie@festival.test"})
        self.assertContains(respuesta, "Revisa tu correo")
        enviar.assert_not_called()

    def test_enlace_invalido(self):
        respuesta = self.client.get("/restablecer-clave/MQ/token-falso", follow=True)
        self.assertContains(respuesta, "El enlace no es válido")
        self.assertTrue(self.votante.check_password(CLAVE_VOTANTE))
