"""Roles y permisos en el panel Django: cada vista exige su permiso y las plantillas ocultan lo que el rol no puede hacer."""

from votaciones.auditoria.models import RegistroAuditoria
from votaciones.cuentas.models import Rol
from votaciones.models import Categoria, Edicion, Usuario, Votacion
from votaciones.sitio.models import ConfiguracionSitio

from .base import BasePortalTest

CLAVE = "Rol2027*seguro"


class ConRolesTest(BasePortalTest):
    def crear_usuario(self, email, rol):
        return Usuario.objects.create_user(email, CLAVE, nombres="Prueba", apellidos=rol.capitalize(), rol=rol,
                                           correo_verificado=True, acepta_tratamiento_datos=True)

    def setUp(self):
        super().setUp()
        self.lectura = self.crear_usuario("lectura@festival.test", Usuario.Rol.LECTURA)
        self.editor = self.crear_usuario("editor@festival.test", Usuario.Rol.EDITOR)


class SoloLecturaTest(ConRolesTest):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.lectura)

    def test_ve_todas_las_listas(self):
        for ruta in ("/panel", "/panel/ediciones", "/panel/categorias", "/panel/votaciones",
                     f"/panel/votaciones/{self.votacion.pk}/opciones", "/panel/votos", f"/panel/votos/{self.votacion.pk}",
                     "/panel/auditoria", "/panel/auditoria?pestana=acciones", "/panel/usuarios", "/panel/roles",
                     "/panel/configuracion/votacion", "/panel/configuracion/demo", "/panel/banner", "/panel/revista",
                     "/panel/sitio", "/panel/marca"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 200)

    def test_no_se_le_ofrecen_acciones_de_escritura(self):
        respuesta = self.client.get("/panel/ediciones")
        self.assertNotContains(respuesta, "/panel/ediciones/nueva")
        self.assertNotContains(respuesta, f"/panel/ediciones/{self.edicion.pk}/editar")
        self.assertNotContains(respuesta, "data-eliminar-url")
        self.assertNotContains(respuesta, "/panel/ediciones/importar")
        self.assertContains(respuesta, "/panel/ediciones/plantilla")  # exportar sí (ediciones.exportar)
        respuesta = self.client.get("/panel/categorias")
        self.assertNotContains(respuesta, "/panel/categorias/nueva")
        self.assertNotContains(respuesta, f"/panel/categorias/{self.categoria.pk}/alternar")
        respuesta = self.client.get("/panel/votaciones")
        self.assertNotContains(respuesta, "/panel/votaciones/nueva")
        self.assertNotContains(respuesta, f"/panel/votaciones/{self.votacion.pk}/cerrar")
        self.assertNotContains(self.client.get("/panel/usuarios"), "/panel/usuarios/")
        self.assertNotContains(self.client.get("/panel/roles"), "/panel/roles/nuevo")
        self.assertContains(self.client.get("/panel/sitio"), "Tu rol solo consulta")
        self.assertNotContains(self.client.get("/panel/sitio"), 'id="form-red"')
        self.assertContains(self.client.get("/panel/configuracion/votacion"), "Tu rol solo consulta la configuración")
        self.assertNotContains(self.client.get("/panel/configuracion/demo"), "/panel/configuracion/demo/eliminar")

    def test_recibe_403_al_crear_editar_o_eliminar(self):
        for ruta in ("/panel/ediciones/nueva", f"/panel/ediciones/{self.edicion.pk}/editar", "/panel/categorias/nueva",
                     f"/panel/categorias/{self.categoria.pk}/editar", "/panel/votaciones/nueva",
                     f"/panel/votaciones/{self.votacion.pk}/editar", f"/panel/votaciones/{self.votacion.pk}/opciones/nueva",
                     "/panel/ediciones/importar", "/panel/banner/nuevo", "/panel/revista/nueva", "/panel/roles/nuevo"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 403)
        for ruta in (f"/panel/ediciones/{self.edicion.pk}/eliminar", f"/panel/categorias/{self.categoria.pk}/alternar",
                     f"/panel/categorias/{self.categoria.pk}/eliminar", f"/panel/votaciones/{self.votacion.pk}/cerrar",
                     f"/panel/votaciones/{self.votacion.pk}/eliminar", f"/panel/usuarios/{self.votante.pk}/rol",
                     "/panel/configuracion/votacion", "/panel/configuracion/demo/eliminar", "/panel/sitio", "/panel/marca",
                     "/panel/banner/modo"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.post(ruta, {"rol": "administrador", "votaciones_pausadas": "on"}).status_code, 403)
        self.categoria.refresh_from_db()
        self.votacion.refresh_from_db()
        self.votante.refresh_from_db()
        self.edicion.refresh_from_db()
        self.assertTrue(self.categoria.activa)
        self.assertTrue(Votacion.objects.filter(pk=self.votacion.pk).exists())
        self.assertEqual(self.votante.rol, Usuario.Rol.VOTANTE)
        self.assertFalse(self.edicion.votaciones_pausadas)

    def test_puede_exportar_resultados(self):
        respuesta = self.client.get(f"/panel/exportar/votacion/{self.votacion.pk}/csv")
        self.assertEqual(respuesta.status_code, 200)

    def test_el_panel_muestra_el_nombre_del_rol(self):
        self.assertContains(self.client.get("/panel"), "Solo lectura")


class EditorTest(ConRolesTest):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.editor)

    def test_crea_edicion_categoria_y_votacion(self):
        datos = {"nombre": "Festival 2028", "anio": 2028, "fecha_inicio": "2028-04-26", "fecha_fin": "2028-04-30",
                 "estado": "cerrada", "presentacion_categorias": "lista"}
        self.assertRedirects(self.client.post("/panel/ediciones/nueva", datos), "/panel/ediciones")
        self.assertTrue(Edicion.objects.filter(anio=2028).exists())
        datos = {"edicion": self.edicion.pk, "nombre": "Piqueria", "descripcion": "Versos", "icono": "music-note", "orden": 2,
                 "activa": "on"}
        self.assertRedirects(self.client.post("/panel/categorias/nueva", datos), "/panel/categorias")
        self.assertTrue(Categoria.objects.filter(nombre="Piqueria").exists())
        datos = {"categoria": self.categoria.pk, "titulo": "Mejor pilonera", "descripcion": "Baile", "icono": "people-fill",
                 "fecha_apertura": "2027-04-28T08:00", "fecha_cierre": "2027-05-01T18:00",
                 "visibilidad_resultados": "al_cierre", "presentacion_opciones": "tarjetas"}
        self.assertRedirects(self.client.post("/panel/votaciones/nueva", datos), "/panel/votaciones")
        self.assertTrue(Votacion.objects.filter(titulo="Mejor pilonera").exists())

    def test_recibe_403_fuera_de_su_alcance(self):
        for ruta in ("/panel/usuarios", "/panel/configuracion/votacion", "/panel/sitio", "/panel/auditoria", "/panel/votos",
                     "/panel/roles", "/panel/banner", "/panel/marca", f"/panel/exportar/votacion/{self.votacion.pk}/csv"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 403)

    def test_el_menu_y_el_inicio_solo_muestran_lo_permitido(self):
        respuesta = self.client.get("/panel")
        self.assertContains(respuesta, 'href="/panel/ediciones"')
        for ruta in ("/panel/usuarios", "/panel/auditoria", "/panel/configuracion", "/panel/roles", "/panel/votos", "/django-admin/"):
            with self.subTest(ruta=ruta):
                self.assertNotContains(respuesta, f'href="{ruta}"')
        self.assertNotContains(respuesta, "Actividad reciente")
        self.assertNotContains(respuesta, "Votos de la edición")
        self.assertContains(respuesta, "Lectura y escritura")


class VotanteTest(ConRolesTest):
    def test_votante_no_entra_al_panel(self):
        self.client.force_login(self.votante)
        for ruta in ("/panel", "/panel/ediciones", "/panel/roles"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 403)


class UsuariosConRolesTest(ConRolesTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_filtra_por_cualquier_rol_y_muestra_su_nombre(self):
        respuesta = self.client.get("/panel/usuarios?rol=lectura")
        self.assertContains(respuesta, self.lectura.email)
        self.assertNotContains(respuesta, self.editor.email)
        self.assertContains(respuesta, "Solo lectura")
        self.assertNotContains(respuesta, "Hacer administrador")

    def test_asigna_cualquier_rol_y_lo_audita(self):
        respuesta = self.client.post(f"/panel/usuarios/{self.votante.pk}/rol", {"rol": "editor"}, follow=True)
        self.assertContains(respuesta, "ahora tiene el rol «Lectura y escritura»")
        self.votante.refresh_from_db()
        self.assertEqual(self.votante.rol, Usuario.Rol.EDITOR)
        self.assertTrue(RegistroAuditoria.objects.filter(accion="cambiar_rol", entidad_id=self.votante.pk).exists())

    def test_rol_inexistente_avisa(self):
        respuesta = self.client.post(f"/panel/usuarios/{self.votante.pk}/rol", {"rol": "inventado"}, follow=True)
        self.assertContains(respuesta, "no existe")

    def test_sin_selector_para_si_mismo(self):
        respuesta = self.client.get("/panel/usuarios")
        self.assertNotContains(respuesta, f"/panel/usuarios/{self.admin.pk}/rol")
        self.assertContains(respuesta, f"/panel/usuarios/{self.votante.pk}/rol")

    def test_paginacion_arriba_y_abajo(self):
        for i in range(30):
            Usuario.objects.create_user(f"persona{i}@festival.test", CLAVE, nombres="Persona", apellidos=str(i))
        respuesta = self.client.get("/panel/usuarios?q=persona")
        self.assertContains(respuesta, 'data-paginacion="arriba"')
        self.assertContains(respuesta, 'data-paginacion="abajo"')
        self.assertContains(respuesta, "q=persona&amp;pagina=2")


class RolesPanelTest(ConRolesTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_lista_de_roles(self):
        respuesta = self.client.get("/panel/roles")
        for nombre in ("Votante", "Solo lectura", "Lectura y escritura", "Administrador"):
            self.assertContains(respuesta, nombre)
        self.assertContains(respuesta, "No editas tu propio rol")
        self.assertEqual(self.client.get("/panel/roles/nuevo").status_code, 200)
        self.assertEqual(self.client.get(f"/panel/roles/{Rol.objects.get(codigo='lectura').pk}/editar").status_code, 200)

    def test_crea_edita_y_elimina_un_rol(self):
        datos = {"nombre": "Jurado", "codigo": "jurado", "descripcion": "Consulta resultados",
                 "permisos": ["panel.ver", "resultados.ver"]}
        self.assertRedirects(self.client.post("/panel/roles/nuevo", datos), "/panel/roles")
        rol = Rol.objects.get(codigo="jurado")
        self.assertEqual(sorted(rol.permisos), ["panel.ver", "resultados.ver"])
        self.assertFalse(rol.sistema)
        self.assertTrue(RegistroAuditoria.objects.filter(accion="crear", entidad="rol", entidad_id=rol.pk).exists())
        datos = {"nombre": "Jurado calificador", "permisos": ["panel.ver", "resultados.ver", "resultados.exportar"]}
        self.assertRedirects(self.client.post(f"/panel/roles/{rol.pk}/editar", datos), "/panel/roles")
        rol.refresh_from_db()
        self.assertEqual(rol.nombre, "Jurado calificador")
        self.assertEqual(rol.codigo, "jurado")
        self.assertIn("resultados.exportar", rol.permisos)
        self.client.post(f"/panel/roles/{rol.pk}/eliminar")
        self.assertFalse(Rol.objects.filter(pk=rol.pk).exists())

    def test_codigo_repetido_o_invalido(self):
        respuesta = self.client.post("/panel/roles/nuevo", {"nombre": "Otro", "codigo": "editor"})
        self.assertIn("codigo", respuesta.context["form"].errors)
        respuesta = self.client.post("/panel/roles/nuevo", {"nombre": "Otro", "codigo": "con espacios"})
        self.assertIn("codigo", respuesta.context["form"].errors)

    def test_cambia_los_permisos_del_rol_lectura(self):
        rol = Rol.objects.get(codigo="lectura")
        self.client.post(f"/panel/roles/{rol.pk}/editar", {"nombre": rol.nombre, "permisos": ["panel.ver", "ediciones.ver"]})
        self.lectura.refresh_from_db()
        self.client.force_login(self.lectura)
        self.assertEqual(self.client.get("/panel/ediciones").status_code, 200)
        self.assertEqual(self.client.get("/panel/votaciones").status_code, 403)

    def test_rol_fijo_conserva_sus_permisos_y_el_del_sistema_no_se_elimina(self):
        votante = Rol.objects.get(codigo="votante")
        respuesta = self.client.get(f"/panel/roles/{votante.pk}/editar")
        self.assertContains(respuesta, "son fijos")
        self.client.post(f"/panel/roles/{votante.pk}/editar", {"nombre": "Votante del público", "permisos": ["panel.ver"]})
        votante.refresh_from_db()
        self.assertEqual(votante.nombre, "Votante del público")
        self.assertEqual(votante.permisos_efectivos, frozenset())
        self.client.post(f"/panel/roles/{Rol.objects.get(codigo='lectura').pk}/eliminar")
        self.assertTrue(Rol.objects.filter(codigo="lectura").exists())

    def test_no_elimina_un_rol_con_usuarios(self):
        rol = Rol.objects.create(codigo="jurado", nombre="Jurado", permisos=["panel.ver"])
        self.crear_usuario("jurado@festival.test", "jurado")
        respuesta = self.client.post(f"/panel/roles/{rol.pk}/eliminar", follow=True)
        self.assertContains(respuesta, "asígnales otro rol")
        self.assertTrue(Rol.objects.filter(pk=rol.pk).exists())

    def test_nadie_edita_su_propio_rol(self):
        administrador = Rol.objects.get(codigo="administrador")
        self.assertRedirects(self.client.get(f"/panel/roles/{administrador.pk}/editar"), "/panel/roles")
        self.client.post(f"/panel/roles/{administrador.pk}/editar", {"nombre": "Jefe"})
        administrador.refresh_from_db()
        self.assertEqual(administrador.nombre, "Administrador")
        # Tampoco un rol delegado que gestiona roles
        gestor = Rol.objects.create(codigo="gestor", nombre="Gestor de roles",
                                    permisos=["panel.ver", "roles.ver", "roles.gestionar", "usuarios.ver"])
        self.client.force_login(self.crear_usuario("gestor@festival.test", "gestor"))
        self.assertEqual(self.client.get("/panel/roles").status_code, 200)
        respuesta = self.client.post(f"/panel/roles/{gestor.pk}/editar",
                                     {"nombre": "Gestor", "permisos": ["panel.ver", "roles.ver", "roles.gestionar"]}, follow=True)
        self.assertContains(respuesta, "No puedes editar tu propio rol")
        gestor.refresh_from_db()
        self.assertEqual(gestor.nombre, "Gestor de roles")
        self.assertIn("usuarios.ver", gestor.permisos)

    def test_un_rol_delegado_no_reparte_permisos_que_no_tiene(self):
        Rol.objects.create(codigo="gestor", nombre="Gestor de roles", permisos=["panel.ver", "roles.ver", "roles.gestionar"])
        self.client.force_login(self.crear_usuario("gestor@festival.test", "gestor"))
        respuesta = self.client.post("/panel/roles/nuevo", {"nombre": "Superpoder", "codigo": "superpoder",
                                                            "permisos": ["panel.ver", "usuarios.cambiar_rol"]}, follow=True)
        self.assertContains(respuesta, "permisos que tu rol no tiene")
        self.assertFalse(Rol.objects.filter(codigo="superpoder").exists())

    def test_lectura_ve_roles_pero_no_los_gestiona(self):
        self.client.force_login(self.lectura)
        self.assertEqual(self.client.get("/panel/roles").status_code, 200)
        rol = Rol.objects.get(codigo="editor")
        self.assertEqual(self.client.post(f"/panel/roles/{rol.pk}/editar", {"nombre": "X"}).status_code, 403)
        self.assertEqual(self.client.post(f"/panel/roles/{rol.pk}/eliminar").status_code, 403)


class PaginacionTest(ConRolesTest):
    def test_auditoria_pagina_arriba_y_abajo(self):
        self.entrar_como_admin()
        RegistroAuditoria.objects.bulk_create(
            RegistroAuditoria(usuario=self.admin, accion="actualizar", entidad="configuracion",
                              entidad_id=ConfiguracionSitio.obtener().pk, detalle={}) for _ in range(60)
        )
        respuesta = self.client.get("/panel/auditoria?pestana=acciones")
        self.assertContains(respuesta, 'data-paginacion="arriba"')
        self.assertContains(respuesta, 'data-paginacion="abajo"')
        self.assertContains(respuesta, "pestana=acciones&amp;pagina=2")
