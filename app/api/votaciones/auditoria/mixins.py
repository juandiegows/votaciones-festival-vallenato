"""Auditoría desde la capa HTTP: toma el usuario y la IP del request y delega en servicios.registrar."""

from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response

from ..comun.api import ip_cliente
from . import servicios


def auditar(request, accion, entidad, entidad_id="", detalle=None):
    usuario = request.user if request.user.is_authenticated else None
    return servicios.registrar(usuario, accion, entidad, entidad_id, detalle, ip_cliente(request))


class AuditadoMixin:
    """CRUD con registro de auditoría. `campos_archivo`: archivos subidos que se borran al reemplazarlos o eliminarlos."""

    # drf-spectacular publica este docstring como descripción de los endpoints: los detalles van en comentarios.
    # validar_eliminacion(objeto) es el gancho para reglas de negocio antes de eliminar (lanza ReglaNegocioError).

    entidad = ""
    campos_archivo = ()

    def perform_create(self, serializer):
        objeto = serializer.save()
        auditar(self.request, "crear", self.entidad, objeto.pk, serializer.data)

    def perform_update(self, serializer):
        anteriores = {campo: getattr(serializer.instance, campo).name for campo in self.campos_archivo}
        objeto = serializer.save()
        for campo, anterior in anteriores.items():
            archivo = getattr(objeto, campo)
            if anterior and anterior != archivo.name:
                archivo.storage.delete(anterior)
        auditar(self.request, "actualizar", self.entidad, objeto.pk, serializer.data)

    def destroy(self, request, *args, **kwargs):
        objeto = self.get_object()
        self.validar_eliminacion(objeto)
        pk = objeto.pk
        nombre = getattr(objeto, "titulo", None) or getattr(objeto, "nombre", None) or str(objeto)
        try:
            self.eliminar(objeto)
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar porque tiene registros asociados; desactívalo.",
                 "codigo": "registros_asociados"},
                status=status.HTTP_409_CONFLICT,
            )
        auditar(request, "eliminar", self.entidad, pk, {"nombre": nombre})
        return Response(status=status.HTTP_204_NO_CONTENT)

    def validar_eliminacion(self, objeto):
        pass

    def eliminar(self, objeto):
        archivos = [getattr(objeto, campo) for campo in self.campos_archivo]
        objeto.delete()
        for archivo in archivos:
            if archivo:
                archivo.storage.delete(archivo.name)
