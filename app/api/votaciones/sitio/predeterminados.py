"""
Valores por defecto de lo que se crea (Configuración → Valores por defecto). Se aplican al crear desde el panel de
Django, desde la web React (que los recibe en la configuración del sitio) y desde la API cuando el campo no se envía.
"""

from .models import ConfiguracionSitio


def para_edicion(configuracion=None):
    c = configuracion or ConfiguracionSitio.obtener()
    return {"presentacion_categorias": c.defecto_presentacion_categorias, "visibilidad_resultados": c.defecto_visibilidad_resultados}


def para_categoria(configuracion=None):
    c = configuracion or ConfiguracionSitio.obtener()
    return {"voto_unico": c.defecto_voto_unico, "activa": c.defecto_categoria_activa}


def para_votacion(configuracion=None):
    """Solo la presentación: la visibilidad se hereda de la edición y las fechas se proponen en el formulario."""
    c = configuracion or ConfiguracionSitio.obtener()
    return {"presentacion_opciones": c.defecto_presentacion_opciones}


def dias_votacion(configuracion=None):
    return (configuracion or ConfiguracionSitio.obtener()).defecto_dias_votacion


class ValoresPorDefectoMixin:
    """Serializador de alta: los campos que no llegan en la petición toman el valor por defecto configurado."""

    valores_por_defecto = None  # función de este módulo que devuelve {campo: valor}

    def create(self, datos):
        for campo, valor in type(self).valores_por_defecto().items():
            datos.setdefault(campo, valor)
        return super().create(datos)
