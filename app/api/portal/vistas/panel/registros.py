"""
Registros del sistema (RF-19, CU-14, RNF-12; como /panel/registros de la web React): los errores que atrapó el interceptor de registros
(servidor) y los que reportó la web (navegador), con la traza y el archivo y la línea donde ocurrieron.
"""

import json

from django.core.paginator import Paginator
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from votaciones.registros import selectores
from votaciones.registros.models import RegistroSistema
from votaciones.registros.serializers import RegistroSistemaSerializer
from votaciones.registros.views import provocar_error_de_prueba

from .base import edicion_panel, render_panel, requiere_permiso

POR_PAGINA = 50
MAX_DESCARGA = 1000
NIVELES = {"CRITICAL": "Crítico", "ERROR": "Error", "WARNING": "Aviso"}
PERIODOS = {"1": "Últimas 24 horas", "7": "Últimos 7 días", "30": "Últimos 30 días"}


def _filtros(request):
    nivel = request.GET.get("nivel", "")
    fuente = request.GET.get("fuente", "")
    dias = request.GET.get("dias", "")
    return {
        "nivel": nivel if nivel in NIVELES else "",
        "fuente": fuente if fuente in RegistroSistema.Fuente.values else "",
        "dias": dias if dias in PERIODOS else "",
        "q": request.GET.get("q", "").strip(),
    }


def _consulta(filtros):
    return selectores.registros(filtros["nivel"] or None, filtros["fuente"] or None, filtros["q"], filtros["dias"] or None)


def _descarga(consulta, formato):
    filas = RegistroSistemaSerializer(consulta[:MAX_DESCARGA], many=True).data
    marca = timezone.localtime().strftime("%Y%m%d-%H%M")
    if formato == "json":
        contenido, tipo = json.dumps(filas, ensure_ascii=False, indent=2, default=str), "application/json"
    else:
        bloques = []
        for f in filas:
            cabecera = f"[{f['fecha_hora']}] {f['nivel']} {f['fuente']} {f['origen']} ref={f['id_solicitud'] or '-'}"
            peticion = f"{f['metodo']} {f['ruta']} · {f['usuario'] or 'anónimo'} · {f['ip'] or '-'}".strip(" ·")
            bloques.append("\n".join(x for x in (cabecera, f["mensaje"], f["ubicacion"], peticion, f["traza"]) if x))
        contenido, tipo, formato = ("\n\n" + "-" * 80 + "\n\n").join(bloques), "text/plain; charset=utf-8", "txt"
    respuesta = HttpResponse(contenido, content_type=tipo)
    respuesta["Content-Disposition"] = f'attachment; filename="registros-{marca}.{formato}"'
    return respuesta


@requiere_permiso("registros.ver")
def registros(request):
    filtros = _filtros(request)
    consulta = _consulta(filtros)
    formato = request.GET.get("descargar", "")
    if formato in ("json", "txt"):
        return _descarga(consulta, formato)
    pagina = Paginator(consulta, POR_PAGINA).get_page(request.GET.get("pagina"))
    return render_panel(request, "portal/panel/registros.html", "registros", edicion_panel(request), {
        "pagina": pagina, "filtros": filtros, "hay_filtros": any(filtros.values()), "niveles": NIVELES,
        "fuentes": dict(RegistroSistema.Fuente.choices), "periodos": PERIODOS, "resumen": selectores.resumen(),
        "max_descarga": MAX_DESCARGA,
    })


@require_POST
@requiere_permiso("registros.ver")
def probar(request):
    """Provoca una excepción sin atrapar: el interceptor la registra y muestra la página 500 con la referencia."""
    provocar_error_de_prueba(request.user)
