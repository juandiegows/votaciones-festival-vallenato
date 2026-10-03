from django.conf import settings
from django.db import models
from django.utils import timezone

from .contexto import usuario_actual


class TrazableQuerySet(models.QuerySet):
    def update(self, **campos):
        """Un update() masivo no pasa por save(): aquí también se marcan las columnas de soporte."""
        campos.setdefault("actualizado_en", timezone.now())
        usuario = usuario_actual()
        if usuario is not None:
            campos.setdefault("actualizado_por", usuario)
        return super().update(**campos)


class ModeloTrazable(models.Model):
    """
    Columnas de soporte: quién y cuándo creó y modificó por última vez cada registro administrable.
    Se llenan solas al guardar con el usuario del request en curso (comun.contexto.UsuarioActualMiddleware);
    fuera de un request (cargar_demo, shell) los usuarios quedan como estaban o en NULL.
    """

    creado_en = models.DateTimeField("creado en", auto_now_add=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="creado por", on_delete=models.SET_NULL, null=True, blank=True,
        editable=False, related_name="+",
    )
    actualizado_en = models.DateTimeField("actualizado en", auto_now=True)
    actualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="actualizado por", on_delete=models.SET_NULL, null=True, blank=True,
        editable=False, related_name="+",
    )

    objects = TrazableQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        usuario = usuario_actual()
        if usuario is not None:
            if self._state.adding and self.creado_por_id is None:
                self.creado_por = usuario
            self.actualizado_por = usuario
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            kwargs["update_fields"] = {*update_fields, "actualizado_en", "actualizado_por"}
        super().save(*args, **kwargs)
