from django.db.models import Q

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
