from .models import Usuario


def correo_registrado(email):
    return Usuario.objects.filter(email=email.lower()).exists()


def documento_registrado(tipo, numero):
    return Usuario.objects.filter(tipo_documento=tipo, numero_documento=numero).exists()


def usuarios(rol=None):
    consulta = Usuario.objects.order_by("id")
    return consulta.filter(rol=rol) if rol else consulta
