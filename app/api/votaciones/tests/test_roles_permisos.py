"""Roles y permisos de la API de administración: cada funcionalidad exige su permiso del catálogo."""

from votaciones.cuentas import permisos as catalogo
from votaciones.models import Rol, Usuario

from .base import BaseAPITest

G = "/api/gestion"


class BaseRoles(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.lector = self.crear_usuario("lectura@festival.test", Usuario.Rol.LECTURA)
        self.editor = self.crear_usuario("editor@festival.test", Usuario.Rol.EDITOR)

    def crear_usuario(self, email, rol):
        return Usuario.objects.create_user(email, "Clave2027*segura", nombres="Prueba", apellidos=rol, rol=rol,
                                           acepta_tratamiento_datos=True, correo_verificado=True)

    def datos_edicion(self, anio=2030):
        return {"nombre": f"Festival {anio}", "anio": anio, "fecha_inicio": f"{anio}-04-28", "fecha_fin": f"{anio}-05-01"}


class RolesInicialesTest(BaseRoles):
    def test_migracion_crea_los_cuatro_roles(self):
        self.assertEqual(set(Rol.objects.values_list("codigo", flat=True)), {"votante", "lectura", "editor", "administrador"})

    def test_permisos_efectivos(self):
        self.assertEqual(self.admin.permisos, catalogo.TODOS)
        self.assertEqual(self.votante.permisos, frozenset())
        self.assertTrue(all(c.endswith(".ver") or c.endswith(".exportar") for c in self.lector.permisos))
        self.assertTrue(self.editor.tiene_permiso("ediciones.crear", "votaciones.publicar", "opciones.eliminar"))
        self.assertFalse(self.editor.tiene_permiso("usuarios.ver"))
        self.assertFalse(self.editor.tiene_permiso("resultados.ver"))

    def test_cuenta_desactivada_no_tiene_permisos(self):
        Usuario.objects.filter(pk=self.admin.pk).update(is_active=False)
        self.assertEqual(Usuario.objects.get(pk=self.admin.pk).permisos, frozenset())

    def test_perfil_expone_rol_y_permisos(self):
        self.autenticar(self.editor)
        datos = self.client.get("/api/auth/yo/").data
        self.assertEqual(datos["rol"], "editor")
        self.assertEqual(datos["rol_nombre"], "Lectura y escritura")
        self.assertIn("ediciones.crear", datos["permisos"])


class LecturaTest(BaseRoles):
    def setUp(self):
        super().setUp()
        self.autenticar(self.lector)

    def test_consulta_todo(self):
        for ruta in ("ediciones", "categorias", "votaciones", "opciones", "votos", "usuarios", "auditoria", "roles", "banners"):
            self.assertEqual(self.client.get(f"{G}/{ruta}/").status_code, 200, ruta)
        self.assertEqual(self.client.get(f"{G}/configuracion/").status_code, 200)
        self.assertEqual(self.client.get(f"{G}/votaciones/{self.abierta.pk}/resultados/").status_code, 200)

    def test_no_cambia_nada(self):
        self.assertEqual(self.client.post(f"{G}/ediciones/", self.datos_edicion(), format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"{G}/categorias/{self.categoria.pk}/", {"nombre": "X"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"{G}/opciones/{self.opcion_a.pk}/").status_code, 403)
        self.assertEqual(self.client.post(f"{G}/votaciones/{self.abierta.pk}/cerrar/").status_code, 403)
        self.assertEqual(self.client.post(f"{G}/usuarios/{self.votante.pk}/rol/", {"rol": "lectura"}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"{G}/configuracion/", {"telefono": "123"}, format="json").status_code, 403)
        self.assertEqual(self.client.post(f"{G}/roles/", {"codigo": "x", "nombre": "X"}, format="json").status_code, 403)


class EditorTest(BaseRoles):
    def setUp(self):
        super().setUp()
        self.autenticar(self.editor)

    def test_escribe_ediciones_categorias_votaciones_y_opciones(self):
        self.assertEqual(self.client.post(f"{G}/ediciones/", self.datos_edicion(), format="json").status_code, 201)
        self.assertEqual(self.client.patch(f"{G}/categorias/{self.categoria.pk}/", {"nombre": "Música vallenata"}, format="json").status_code, 200)
        self.assertEqual(self.client.post(f"{G}/votaciones/{self.abierta.pk}/cerrar/").status_code, 200)

    def test_no_entra_a_lo_demas(self):
        for ruta in ("votos", "usuarios", "auditoria", "roles", "banners", "revistas", "redes"):
            self.assertEqual(self.client.get(f"{G}/{ruta}/").status_code, 403, ruta)
        self.assertEqual(self.client.get(f"{G}/votaciones/{self.abierta.pk}/resultados/").status_code, 403)
        self.assertEqual(self.client.get(f"{G}/ediciones/{self.edicion.pk}/exportar/").status_code, 403)
        self.assertEqual(self.client.patch(f"{G}/configuracion/", {"pedir_documento": True}, format="json").status_code, 403)

    def test_guardar_configuracion_sin_cambios_no_exige_permiso(self):
        # La web envía la configuración completa: lo que no cambia no cuenta
        actual = self.client.get(f"{G}/configuracion/").data
        self.assertEqual(self.client.patch(f"{G}/configuracion/", {"telefono": actual["telefono"]}, format="json").status_code, 200)


class VotanteTest(BaseRoles):
    def test_sin_acceso_a_gestion(self):
        self.autenticar(self.votante)
        self.assertEqual(self.client.get(f"{G}/ediciones/").status_code, 403)
        self.assertEqual(self.client.get(f"{G}/configuracion/").status_code, 403)


class CambiarRolTest(BaseRoles):
    def cambiar(self, usuario, rol):
        return self.client.post(f"{G}/usuarios/{usuario.pk}/rol/", {"rol": rol}, format="json")

    def test_administrador_asigna_cualquier_rol(self):
        self.autenticar(self.admin)
        respuesta = self.cambiar(self.votante, "editor")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["rol_nombre"], "Lectura y escritura")
        self.assertEqual(Usuario.objects.get(pk=self.votante.pk).rol, "editor")

    def test_rol_inexistente(self):
        self.autenticar(self.admin)
        self.assertEqual(self.cambiar(self.votante, "superpoderes").status_code, 400)

    def test_nadie_cambia_su_propio_rol(self):
        Usuario.objects.create_user("otro@festival.test", "Clave2027*segura", nombres="Otro", apellidos="Admin",
                                    rol=Usuario.Rol.ADMINISTRADOR, acepta_tratamiento_datos=True)
        self.autenticar(self.admin)
        self.assertEqual(self.cambiar(self.admin, "votante").status_code, 400)

    def test_quien_deja_de_ser_administrador_pierde_el_acceso(self):
        otro = Usuario.objects.create_user("otro@festival.test", "Clave2027*segura", nombres="Otro", apellidos="Admin",
                                           rol=Usuario.Rol.ADMINISTRADOR, acepta_tratamiento_datos=True)
        self.autenticar(otro)
        self.assertEqual(self.cambiar(self.admin, "votante").status_code, 200)
        self.autenticar(self.admin)  # ya no es administrador
        self.assertEqual(self.cambiar(otro, "votante").status_code, 403)

    def test_rol_delegado_no_sube_de_nivel(self):
        # Rol con permiso de cambiar roles pero sin el resto: no puede repartir permisos que no tiene
        Rol.objects.create(codigo="gestor", nombre="Gestor de usuarios",
                           permisos=["panel.ver", "usuarios.ver", "usuarios.cambiar_rol"])
        gestor = self.crear_usuario("gestor@festival.test", "gestor")
        self.autenticar(gestor)
        self.assertEqual(self.cambiar(self.votante, "administrador").status_code, 403)
        self.assertEqual(self.cambiar(self.votante, "editor").status_code, 403)
        self.assertEqual(self.cambiar(self.editor, "votante").status_code, 403)  # quitarle permisos que no tiene
        self.assertEqual(self.cambiar(self.votante, "gestor").status_code, 200)


class GestionRolesTest(BaseRoles):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def test_catalogo(self):
        datos = self.client.get(f"{G}/roles/catalogo/").data
        codigos = {p["codigo"] for grupo in datos for p in grupo["permisos"]}
        self.assertEqual(codigos, set(catalogo.TODOS))

    def test_crear_editar_y_eliminar_rol(self):
        respuesta = self.client.post(f"{G}/roles/", {"codigo": "jurado", "nombre": "Jurado", "permisos": ["panel.ver", "resultados.ver"]}, format="json")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        pk = respuesta.data["id"]
        respuesta = self.client.patch(f"{G}/roles/{pk}/", {"permisos": ["panel.ver", "resultados.ver", "auditoria.ver"]}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("auditoria.ver", respuesta.data["permisos"])
        self.assertEqual(self.client.delete(f"{G}/roles/{pk}/").status_code, 204)

    def test_permiso_desconocido(self):
        respuesta = self.client.post(f"{G}/roles/", {"codigo": "x", "nombre": "X", "permisos": ["borrar.todo"]}, format="json")
        self.assertEqual(respuesta.status_code, 400)

    def test_ajustar_permisos_de_lectura(self):
        lectura = Rol.objects.get(codigo="lectura")
        respuesta = self.client.patch(f"{G}/roles/{lectura.pk}/", {"permisos": ["panel.ver", "ediciones.ver"]}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(Usuario.objects.get(pk=self.lector.pk).permisos, {"panel.ver", "ediciones.ver"})

    def test_roles_fijos_y_del_sistema(self):
        administrador = Rol.objects.get(codigo="administrador")
        votante = Rol.objects.get(codigo="votante")
        # El administrador no edita su propio rol; otro rol fijo no cambia de permisos
        self.assertEqual(self.client.patch(f"{G}/roles/{administrador.pk}/", {"permisos": []}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"{G}/roles/{votante.pk}/", {"permisos": ["panel.ver"]}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(f"{G}/roles/{votante.pk}/", {"descripcion": "Vota"}, format="json").status_code, 200)
        self.assertEqual(self.client.delete(f"{G}/roles/{votante.pk}/").status_code, 400)

    def test_no_elimina_rol_con_usuarios(self):
        Rol.objects.create(codigo="temporal", nombre="Temporal", permisos=["panel.ver"])
        self.crear_usuario("temporal@festival.test", "temporal")
        self.assertEqual(self.client.delete(f"{G}/roles/{Rol.objects.get(codigo='temporal').pk}/").status_code, 409)

    def test_codigo_no_cambia(self):
        lectura = Rol.objects.get(codigo="lectura")
        self.assertEqual(self.client.patch(f"{G}/roles/{lectura.pk}/", {"codigo": "otro"}, format="json").status_code, 400)

    def test_rol_delegado_solo_reparte_lo_que_tiene(self):
        Rol.objects.create(codigo="jefe", nombre="Jefe de roles", permisos=["panel.ver", "roles.ver", "roles.gestionar"])
        self.autenticar(self.crear_usuario("jefe@festival.test", "jefe"))
        lectura = Rol.objects.get(codigo="lectura")
        self.assertEqual(self.client.patch(f"{G}/roles/{lectura.pk}/", {"permisos": ["panel.ver", "usuarios.cambiar_rol"]}, format="json").status_code, 403)
        self.assertEqual(self.client.post(f"{G}/roles/", {"codigo": "y", "nombre": "Y", "permisos": ["sitio.editar"]}, format="json").status_code, 403)
        jefe = Rol.objects.get(codigo="jefe")
        self.assertEqual(self.client.patch(f"{G}/roles/{jefe.pk}/", {"permisos": catalogo.validos(catalogo.TODOS)}, format="json").status_code, 403)


class DjangoAdminTest(BaseRoles):
    def test_solo_con_permiso_django_admin(self):
        self.assertTrue(self.admin.has_perm("votaciones.change_edicion"))
        self.assertFalse(self.lector.has_perm("votaciones.view_edicion"))
