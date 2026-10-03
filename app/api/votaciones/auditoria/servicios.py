from .models import RegistroAuditoria


def registrar(usuario, accion, entidad, entidad_id="", detalle=None, ip=None):
    """Deja constancia de una acción administrativa (RF-16, RN-12). `usuario` puede ser None (acción anónima)."""
    return RegistroAuditoria.objects.create(
        usuario=usuario,
        accion=accion,
        entidad=entidad,
        entidad_id=str(entidad_id),
        detalle=detalle or {},
        ip=ip,
    )
