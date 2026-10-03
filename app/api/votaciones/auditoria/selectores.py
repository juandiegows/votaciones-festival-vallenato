from django.db.models import Q

from ..sitio.models import BannerInicio, ConfiguracionSitio, RedSocial, Revista
from ..votacion.models import Categoria, Opcion, Votacion
from .models import RegistroAuditoria


def registros(accion=None, entidad=None, texto=""):
    """Registro de acciones filtrado; `texto` busca en el correo o nombre del usuario y en el ID de la entidad."""
    consulta = RegistroAuditoria.objects.select_related("usuario")
    if accion:
        consulta = consulta.filter(accion=accion)
    if entidad:
        consulta = consulta.filter(entidad=entidad)
    texto = (texto or "").strip()
    if texto:
        consulta = consulta.filter(
            Q(usuario__email__icontains=texto) | Q(usuario__nombres__icontains=texto)
            | Q(usuario__apellidos__icontains=texto) | Q(entidad_id=texto)
        )
    return consulta


def _fila(entidad, objeto, nombre):
    return {
        "entidad": entidad,
        "entidad_id": objeto.pk,
        "nombre": nombre,
        "creado_en": objeto.creado_en,
        "creado_por": str(objeto.creado_por) if objeto.creado_por else None,
        "actualizado_en": objeto.actualizado_en,
        "actualizado_por": str(objeto.actualizado_por) if objeto.actualizado_por else None,
    }


def autoria(edicion):
    """
    Quién creó y quién modificó por última vez cada registro administrable: la edición con sus categorías,
    votaciones, opciones y banners, y el contenido general del sitio. Lo más reciente primero.
    """
    usuarios = ("creado_por", "actualizado_por")
    filas = [_fila("edicion", edicion, edicion.nombre)]
    filas += [_fila("categoria", c, c.nombre) for c in Categoria.objects.filter(edicion=edicion).select_related(*usuarios)]
    filas += [
        _fila("votacion", v, v.titulo)
        for v in Votacion.objects.filter(categoria__edicion=edicion).select_related(*usuarios)
    ]
    filas += [
        _fila("opcion", o, o.nombre)
        for o in Opcion.objects.filter(votacion__categoria__edicion=edicion).select_related(*usuarios)
    ]
    filas += [
        _fila("banner", b, b.titulo or b.texto_alternativo)
        for b in BannerInicio.objects.filter(edicion=edicion).select_related(*usuarios)
    ]
    filas += [_fila("revista", r, r.titulo) for r in Revista.objects.select_related(*usuarios)]
    filas += [_fila("red_social", r, r.nombre) for r in RedSocial.objects.select_related(*usuarios)]
    configuracion = ConfiguracionSitio.objects.select_related(*usuarios).filter(pk=1).first()
    if configuracion:
        filas.append(_fila("configuracion", configuracion, "Configuración del sitio"))
    filas.sort(key=lambda f: f["actualizado_en"], reverse=True)
    return {"edicion_id": edicion.pk, "edicion": edicion.nombre, "registros": filas}
