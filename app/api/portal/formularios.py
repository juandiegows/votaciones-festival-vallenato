"""
Formularios de Django: registro, inicio de sesión, documento, recuperación de contraseña y administración de
ediciones, categorías, votaciones y opciones.
"""

import re

from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.forms import SetPasswordForm
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework.exceptions import ValidationError as ErrorDRF

from votaciones.comun import campos
from votaciones.comun.errores import ReglaNegocioError
from votaciones.cuentas import selectores as selectores_cuentas
from votaciones.cuentas.documentos import error_formato_documento, normalizar_documento
from votaciones.models import Categoria, Edicion, Opcion, Usuario, Votacion
from votaciones.votacion.servicios import validar_cambio_voto_unico

from .catalogos import ICONOS_DISPONIBLES
from .templatetags.portal import URL_ICONO, icono_desde_url

FORMATO_FECHA_HORA = "%Y-%m-%dT%H:%M"


def validar_con(validador, valor):
    """Reutiliza los validadores de la API (comun.campos) y convierte su error en uno de formularios de Django."""
    try:
        return validador(valor)
    except ErrorDRF as error:
        detalle = error.detail[0] if isinstance(error.detail, list) else error.detail
        raise forms.ValidationError(str(detalle))


def contrasena_segura(valor):
    """Mínimo 8 caracteres, una mayúscula, un número y un símbolo (la misma regla de la web)."""
    return len(valor) >= 8 and re.search(r"[A-ZÁÉÍÓÚÑ]", valor) and re.search(r"\d", valor) and re.search(r"[^A-Za-z0-9]", valor)


# Cuentas


class RegistroForm(forms.Form):
    nombres = forms.CharField(label="Nombres", max_length=100)
    apellidos = forms.CharField(label="Apellidos", max_length=100)
    tipo_documento = forms.ChoiceField(label="Tipo de documento", choices=Usuario.TipoDocumento.choices, required=False)
    numero_documento = forms.CharField(label="Número de documento", max_length=30, required=False)
    email = forms.EmailField(label="Correo electrónico", error_messages={"invalid": "Ingresa un correo electrónico válido."})
    password = forms.CharField(label="Contraseña", strip=False, widget=forms.PasswordInput(render_value=True))
    confirmacion = forms.CharField(label="Confirmar contraseña", strip=False, widget=forms.PasswordInput(render_value=True))
    acepta_tratamiento_datos = forms.BooleanField(
        error_messages={"required": "Debes aceptar la política de tratamiento de datos para registrarte."}
    )

    def __init__(self, *args, pedir_documento=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.pedir_documento = pedir_documento

    def clean_nombres(self):
        valor = self.cleaned_data["nombres"].strip()
        if len(valor) < 2:
            raise forms.ValidationError("Ingresa tus nombres.")
        return valor

    def clean_apellidos(self):
        valor = self.cleaned_data["apellidos"].strip()
        if len(valor) < 2:
            raise forms.ValidationError("Ingresa tus apellidos.")
        return valor

    def clean_email(self):
        valor = self.cleaned_data["email"].lower()
        if selectores_cuentas.correo_registrado(valor):
            raise forms.ValidationError("Ya existe una cuenta con este correo.")
        return valor

    def clean(self):
        datos = super().clean()
        clave, confirmacion = datos.get("password", ""), datos.get("confirmacion", "")
        if clave and not contrasena_segura(clave):
            self.add_error("password", "Mínimo 8 caracteres, con una mayúscula, un número y un símbolo.")
        elif clave:
            try:
                validate_password(clave, Usuario(email=datos.get("email"), nombres=datos.get("nombres", "")))
            except forms.ValidationError as error:
                self.add_error("password", error)
        if not confirmacion or confirmacion != clave:
            self.add_error("confirmacion", "Las contraseñas no coinciden.")
        self.limpiar_documento(datos)
        return datos

    def limpiar_documento(self, datos):
        """Solo se pide si la administración lo activa (P-01): formato por tipo y una cuenta por documento."""
        tipo = datos.get("tipo_documento") or "" if self.pedir_documento else ""
        numero = normalizar_documento(datos.get("numero_documento")) if self.pedir_documento else ""
        if self.pedir_documento:
            error = "Ingresa tu número de documento." if not numero else error_formato_documento(tipo, numero)
            if not error and selectores_cuentas.documento_registrado(tipo, numero):
                error = "Ya existe una cuenta con este documento."
            if error:
                self.add_error("numero_documento", error)
        datos["tipo_documento"], datos["numero_documento"] = tipo, numero or None

    def datos_cuenta(self):
        """Campos que recibe servicios.registrar_votante."""
        datos = self.cleaned_data
        return {
            "email": datos["email"], "password": datos["password"], "nombres": datos["nombres"],
            "apellidos": datos["apellidos"], "tipo_documento": datos["tipo_documento"],
            "numero_documento": datos["numero_documento"], "acepta_tratamiento_datos": True,
        }


class CompletarDocumentoForm(forms.Form):
    """Para quien se registró sin documento y la administración luego empezó a pedirlo para votar."""

    tipo_documento = forms.ChoiceField(label="Tipo de documento", choices=Usuario.TipoDocumento.choices)
    numero_documento = forms.CharField(label="Número de documento", max_length=30)

    def clean(self):
        datos = super().clean()
        tipo, numero = datos.get("tipo_documento"), normalizar_documento(datos.get("numero_documento"))
        if tipo and numero:
            error = error_formato_documento(tipo, numero)
            if not error and selectores_cuentas.documento_registrado(tipo, numero):
                error = "Ya existe una cuenta con este documento."
            if error:
                self.add_error("numero_documento", error)
        datos["numero_documento"] = numero
        return datos


class RecuperarClaveForm(forms.Form):
    email = forms.EmailField(label="Correo electrónico", error_messages={"invalid": "Ingresa un correo electrónico válido."})


class NuevaClaveForm(SetPasswordForm):
    """Nueva contraseña desde el enlace del correo, con la misma regla de seguridad del registro."""

    def clean_new_password1(self):
        clave = self.cleaned_data["new_password1"]
        if not contrasena_segura(clave):
            raise forms.ValidationError("Mínimo 8 caracteres, con una mayúscula, un número y un símbolo.")
        return clave


class LoginForm(forms.Form):
    email = forms.EmailField(label="Correo electrónico")
    password = forms.CharField(label="Contraseña", strip=False, widget=forms.PasswordInput)

    def __init__(self, *args, request=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.request = request
        self.usuario = None

    def clean(self):
        datos = super().clean()
        if not datos.get("email") or not datos.get("password"):
            raise forms.ValidationError("Ingresa tu correo y tu contraseña.")
        self.usuario = authenticate(self.request, email=datos["email"].lower(), password=datos["password"])
        if self.usuario is None:
            raise forms.ValidationError("Correo o contraseña incorrectos.")
        return datos


# Administración (/panel)


class FormularioPanel(forms.ModelForm):
    """Base de los formularios del panel: valida el slug opcional (único dentro de `campo_ambito`)."""

    campo_ambito = ""

    def clean_slug(self):
        return validar_con(campos.validar_slug, self.cleaned_data.get("slug"))

    def validar_slug_unico(self, datos):
        slug, ambito = datos.get("slug"), datos.get(self.campo_ambito)
        if not slug or ambito is None:
            return
        repetidos = self._meta.model.objects.filter(**{self.campo_ambito: ambito, "slug": slug}).exclude(pk=self.instance.pk)
        if repetidos.exists():
            self.add_error("slug", "Ya existe otro elemento con este identificador de URL.")


class IconoMixin:
    """Ícono propio subido (reemplaza al de la lista) con la opción de quitarlo (campo `quitar_icono`)."""

    def clean_icono_imagen(self):
        archivo = self.cleaned_data.get("icono_imagen")
        if archivo and "icono_imagen" in self.files:
            validar_con(campos.validar_icono, archivo)
        return archivo

    def aplicar_quitar_icono(self, objeto):
        if self.cleaned_data.get("quitar_icono") and "icono_imagen" not in self.files and objeto.icono_imagen:
            objeto.icono_imagen.delete(save=False)
            objeto.icono_imagen = ""


class EdicionForm(forms.ModelForm):
    class Meta:
        model = Edicion
        fields = ["nombre", "anio", "fecha_inicio", "fecha_fin", "estado", "presentacion_categorias"]
        labels = {"anio": "Año", "fecha_inicio": "Fecha de inicio", "fecha_fin": "Fecha de fin",
                  "presentacion_categorias": "Presentación de categorías al público"}
        widgets = {
            "fecha_inicio": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "fecha_fin": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
        }
        error_messages = {"anio": {"unique": "Ya existe una edición con este año."}}

    def clean_nombre(self):
        valor = self.cleaned_data["nombre"].strip()
        if len(valor) < 5:
            raise forms.ValidationError("Escribe el nombre completo de la edición.")
        return valor

    def clean_anio(self):
        anio = self.cleaned_data["anio"]
        if not 2000 <= anio <= 2100:
            raise forms.ValidationError("Ingresa un año entre 2000 y 2100.")
        return anio

    def clean(self):
        datos = super().clean()
        inicio, fin = datos.get("fecha_inicio"), datos.get("fecha_fin")
        if inicio and fin and fin < inicio:
            self.add_error("fecha_fin", "Debe ser igual o posterior a la fecha de inicio.")
        return datos


class CategoriaForm(IconoMixin, FormularioPanel):
    campo_ambito = "edicion"
    icono = forms.ChoiceField(label="Ícono de la lista", choices=ICONOS_DISPONIBLES, required=False)
    quitar_icono = forms.BooleanField(label="Quitar el ícono subido", required=False)

    class Meta:
        model = Categoria
        fields = ["edicion", "nombre", "slug", "descripcion", "icono", "icono_imagen", "orden", "activa", "voto_unico"]
        labels = {
            "slug": "Identificador en la URL", "icono_imagen": "Ícono propio", "activa": "Categoría activa (visible al público)",
            "voto_unico": "Un solo voto en toda la categoría",
        }
        widgets = {"descripcion": forms.Textarea(attrs={"rows": 2})}
        error_messages = {"edicion": {"required": "Toda categoría debe pertenecer a una edición."}}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Las ediciones cerradas no reciben categorías nuevas; al editar se conserva la edición actual
        abiertas = ~Q(estado=Edicion.Estado.CERRADA) | Q(pk=self.instance.edicion_id if self.instance.pk else None)
        self.fields["edicion"].queryset = Edicion.objects.filter(abiertas)
        self.fields["edicion"].empty_label = None
        self.fields["descripcion"].required = True
        self.fields["descripcion"].error_messages["required"] = "La descripción es obligatoria."

    def clean_nombre(self):
        valor = self.cleaned_data["nombre"].strip()
        if len(valor) < 3:
            raise forms.ValidationError("El nombre debe tener al menos 3 caracteres.")
        return valor

    def clean(self):
        datos = super().clean()
        edicion = datos.get("edicion")
        if edicion and edicion.estado == Edicion.Estado.CERRADA and self.instance.edicion_id != edicion.pk:
            self.add_error("edicion", "La edición está cerrada: no se pueden agregar categorías.")
        if "voto_unico" in datos:
            try:
                validar_cambio_voto_unico(self.instance, datos["voto_unico"])
            except ReglaNegocioError as error:
                self.add_error("voto_unico", error.mensaje)
        self.validar_slug_unico(datos)
        return datos

    def save(self, commit=True):
        categoria = super().save(commit=False)
        self.aplicar_quitar_icono(categoria)
        if commit:
            categoria.save()
        return categoria


class VotacionForm(IconoMixin, FormularioPanel):
    campo_ambito = "categoria"
    icono = forms.ChoiceField(label="Ícono de la lista", choices=ICONOS_DISPONIBLES, required=False)
    quitar_icono = forms.BooleanField(label="Quitar el ícono subido", required=False)

    class Meta:
        model = Votacion
        fields = [
            "categoria", "titulo", "slug", "descripcion", "icono_imagen", "fecha_apertura", "fecha_cierre",
            "visibilidad_resultados", "personalizar_resultados",
            "presentacion_opciones", "publicada",
        ]
        labels = {
            "titulo": "Título", "slug": "Identificador en la URL", "descripcion": "Descripción", "icono_imagen": "Ícono propio",
            "fecha_apertura": "Fecha y hora de apertura", "fecha_cierre": "Fecha y hora de cierre",
            "visibilidad_resultados": "Mostrar resultados",
            "personalizar_resultados": "Personalizar en esta votación (no usar la de la edición)",
            "publicada": "Publicar votación (visible al público)",
        }
        widgets = {
            "descripcion": forms.Textarea(attrs={"rows": 2}),
            "fecha_apertura": forms.DateTimeInput(attrs={"type": "datetime-local"}, format=FORMATO_FECHA_HORA),
            "fecha_cierre": forms.DateTimeInput(attrs={"type": "datetime-local"}, format=FORMATO_FECHA_HORA),
            "presentacion_opciones": forms.RadioSelect,
        }

    def __init__(self, *args, edicion=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["categoria"].queryset = Categoria.objects.filter(edicion=edicion) if edicion else Categoria.objects.none()
        self.fields["categoria"].empty_label = None
        self.fields["descripcion"].required = True
        self.fields["descripcion"].error_messages["required"] = "La descripción es obligatoria."
        for campo in ("fecha_apertura", "fecha_cierre"):
            self.fields[campo].input_formats = [FORMATO_FECHA_HORA]
        if self.instance.pk:
            self.initial.setdefault("icono", icono_desde_url(self.instance.imagen))

    def clean_titulo(self):
        valor = self.cleaned_data["titulo"].strip()
        if len(valor) < 3:
            raise forms.ValidationError("El título debe tener al menos 3 caracteres.")
        return valor

    def clean(self):
        datos = super().clean()
        self.validar_slug_unico(datos)
        apertura, cierre = datos.get("fecha_apertura"), datos.get("fecha_cierre")
        if apertura and cierre and cierre <= apertura:
            self.add_error("fecha_cierre", "Debe ser posterior a la fecha de apertura.")
        self.validar_publicacion(datos.get("publicada"))
        return datos

    def validar_publicacion(self, publicar):
        """RN-06: se publica con al menos dos opciones activas; una votación abierta no se despublica."""
        votacion = self.instance
        if publicar and not votacion.publicada:
            activas = votacion.opciones.filter(activa=True).count() if votacion.pk else 0
            if activas < 2:
                self.add_error("publicada", f"Se requieren al menos 2 opciones activas para publicar (tiene {activas}). "
                                            "Guárdala como borrador y agrega sus opciones.")
        if not publicar and votacion.pk and votacion.publicada and votacion.estado == Votacion.Estado.ABIERTA:
            self.add_error("publicada", "No se puede despublicar una votación abierta: ciérrala primero.")

    def save(self, commit=True):
        votacion = super().save(commit=False)
        icono = self.cleaned_data.get("icono")
        votacion.imagen = f"{URL_ICONO}{icono}/" if icono else votacion.imagen
        self.aplicar_quitar_icono(votacion)
        if commit:
            votacion.save()
        return votacion


class OpcionForm(forms.ModelForm):
    quitar_audio = forms.BooleanField(label="Quitar el audio subido", required=False)

    class Meta:
        model = Opcion
        fields = ["nombre", "descripcion", "enlace_multimedia", "audio", "texto_audio", "orden", "activa"]
        labels = {
            "descripcion": "Descripción", "enlace_multimedia": "Enlace multimedia", "audio": "Archivo de audio",
            "texto_audio": "Letra o transcripción", "activa": "Opción activa",
        }
        widgets = {"descripcion": forms.Textarea(attrs={"rows": 2}), "texto_audio": forms.Textarea(attrs={"rows": 3})}

    def clean_nombre(self):
        valor = self.cleaned_data["nombre"].strip()
        if len(valor) < 2:
            raise forms.ValidationError("Escribe el nombre de la opción.")
        return valor

    def clean_enlace_multimedia(self):
        return validar_con(campos.validar_enlace, self.cleaned_data.get("enlace_multimedia"))

    def clean_audio(self):
        archivo = self.cleaned_data.get("audio")
        if archivo and "audio" in self.files:
            validar_con(campos.validar_audio, archivo)
        return archivo

    def save(self, commit=True):
        opcion = super().save(commit=False)
        if self.cleaned_data.get("quitar_audio") and "audio" not in self.files and opcion.audio:
            opcion.audio.delete(save=False)
            opcion.audio = ""
        if commit:
            opcion.save()
        return opcion
