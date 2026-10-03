"""
Carga datos de demostración equivalentes a `app/web/src/data/seed.js`.

Los datos son ILUSTRATIVOS: categorías, votaciones y opciones no han sido confirmadas por la Fundación
Festival de la Leyenda Vallenata, y todos los nombres de personas, canciones y agrupaciones son ficticios.
Las fechas de la edición activa son relativas al momento de la carga, para que siempre haya votaciones
abiertas, programadas y cerradas; las ediciones 2025 y 2026 quedan cerradas con resultados publicados.
También crea un banner del inicio por edición (imágenes abstractas generadas aquí), los datos de contacto y las redes.

Uso:
    python manage.py cargar_demo              # carga si aún no existen (idempotente)
    python manage.py cargar_demo --reiniciar  # borra los datos de demostración y los vuelve a cargar
"""
import io
import random
import unicodedata
from datetime import date, datetime, timedelta

from django.contrib.auth.hashers import make_password
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from PIL import Image, ImageDraw

from votaciones.models import (
    BannerInicio, Categoria, ConfiguracionSitio, Edicion, Opcion, RedSocial, RegistroAuditoria, Usuario, Votacion, Voto,
)

# Las votaciones guardan su ícono ilustrativo como URL de Bootstrap Icons (el campo `imagen` es URL);
# la web extrae el nombre del ícono de esta dirección.
URL_ICONO = "https://icons.getbootstrap.com/icons/{}/"

ADMIN = {"email": "admin@festival.test", "password": "Admin2027*", "nombres": "Administrador", "apellidos": "Festival"}
VOTANTE = {"email": "votante@festival.test", "password": "Voto2027*", "nombres": "Valentina", "apellidos": "Ospino Carrillo"}
DOMINIO_FICTICIOS = "demo.festival.test"
CLAVE_FICTICIOS = "Demo2027*"
NUM_FICTICIOS = 100
COMPROBANTE_VOTANTE_DEMO = "FLV27-8F3K2A"

EDICIONES = [
    {"nombre": "Festival de la Leyenda Vallenata 2027", "anio": 2027, "fecha_inicio": date(2027, 4, 28),
     "fecha_fin": date(2027, 5, 2), "estado": Edicion.Estado.ACTIVA, "presentacion_categorias": "tarjetas"},
    {"nombre": "Festival de la Leyenda Vallenata 2026", "anio": 2026, "fecha_inicio": date(2026, 4, 29),
     "fecha_fin": date(2026, 5, 3), "estado": Edicion.Estado.CERRADA, "presentacion_categorias": "lista"},
    {"nombre": "Festival de la Leyenda Vallenata 2025", "anio": 2025, "fecha_inicio": date(2025, 4, 26),
     "fecha_fin": date(2025, 4, 30), "estado": Edicion.Estado.CERRADA, "presentacion_categorias": "mosaico"},
]
ANIO_ACTIVO = 2027

CATEGORIAS = [
    ("Música", "Votaciones del público sobre las canciones que suenan en el Festival.", "music-note-beamed"),
    ("Piloneras", "Las comparsas que llenan de color el desfile de Piloneras.", "people-fill"),
    ("Vestuario", "El vestuario típico que representa la tradición del Cesar.", "stars"),
    ("Agrupaciones", "Conjuntos vallenatos que se presentan en las tarimas del Festival.", "boombox-fill"),
    ("Reconocimientos del público", "Personajes que el público quiere destacar en esta edición.", "award-fill"),
]

V = Votacion.Visibilidad
# (clave, categoría, título, descripción, apertura (días, horas), cierre (días, horas), visibilidad, ícono, publicada)
VOTACIONES = [
    (1, "Música", "Canción favorita del público",
     "Elige la canción que más te ha gustado entre las finalistas de la convocatoria del público.",
     (-6, 0), (9, 5), V.TIEMPO_REAL, "music-note-beamed", True),
    (2, "Música", "Canción inédita revelación",
     "Votación del público entre canciones inéditas presentadas en la edición.",
     (-25, 0), (-3, 0), V.AL_CIERRE, "vinyl-fill", True),
    (3, "Piloneras", "Mejor comparsa de Piloneras",
     "Escoge la comparsa con mejor coreografía, alegría y representación de la tradición.",
     (-3, 0), (5, 2), V.AL_CIERRE, "people-fill", True),
    (4, "Vestuario", "Mejor vestuario típico",
     "Vota por la propuesta de vestuario que mejor representa la cultura vallenata.",
     (12, 0), (20, 0), V.AL_CIERRE, "stars", True),
    (5, "Agrupaciones", "Agrupación favorita",
     "Selecciona la agrupación que más te ha hecho vibrar en tarima.",
     (-2, 0), (12, 0), V.NO_PUBLICAR, "boombox-fill", True),
    (6, "Agrupaciones", "Mejor agrupación juvenil",
     "Reconocimiento del público a los semilleros y agrupaciones juveniles.",
     (15, 0), (25, 0), V.TIEMPO_REAL, "music-player-fill", True),
    (7, "Reconocimientos del público", "Personaje del Festival",
     "El público elige al personaje que mejor representa el espíritu del Festival.",
     (-30, 0), (-8, 0), V.AL_CIERRE, "award-fill", True),
    # Borrador sin publicar con una sola opción: sirve para demostrar RN-06.
    (8, "Música", "Mejor acordeonero aficionado",
     "Votación en preparación. Requiere al menos 2 opciones para publicarse.",
     (30, 0), (40, 0), V.AL_CIERRE, "music-note", False),
]

OPCIONES = {
    1: [
        ("Canción A – 'Brisas del Guatapurí' (ficticia)", "Paseo vallenato sobre los recuerdos del río."),
        ("Canción B – 'Luna de Valledupar' (ficticia)", "Merengue romántico con aires de serenata."),
        ("Canción C – 'El Pilón de mi Tierra' (ficticia)", "Puya alegre inspirada en las fiestas populares."),
        ("Canción D – 'Sabanas del Cesar' (ficticia)", "Son que describe los paisajes de la región."),
        ("Canción E – 'Caminos de la Sierra' (ficticia)", "Paseo que narra un viaje a la Sierra Nevada."),
    ],
    2: [
        ("'Corazón Sabanero' (ficticia)", "Canción inédita, aire de paseo."),
        ("'Recuerdos de Mi Pueblo' (ficticia)", "Canción inédita, aire de son."),
        ("'La Brisa y el Acordeón' (ficticia)", "Canción inédita, aire de merengue."),
        ("'Cantor de Mi Tierra' (ficticia)", "Canción inédita, aire de puya."),
    ],
    3: [
        ("Comparsa Las Marías del Valle", "Grupo de 40 bailarinas con coreografía tradicional."),
        ("Comparsa Pilón de Oro", "Comparsa familiar con tres generaciones de piloneros."),
        ("Comparsa Raíces del Cesar", "Propuesta que rinde homenaje a la vida campesina."),
        ("Comparsa Mujeres del Guatapurí", "Colectivo de mujeres con vestuario artesanal."),
        ("Comparsa Juventud Pilonera", "Semillero de jóvenes de colegios de la ciudad."),
    ],
    4: [
        ("Propuesta 1 – Pollera y camisa campesina", "Vestuario tradicional con estampado floral."),
        ("Propuesta 2 – Atuendo del cantor sabanero", "Sombrero vueltiao, mochila y guayabera."),
        ("Propuesta 3 – Homenaje a la Sierra Nevada", "Inspirado en los tejidos de la región."),
        ("Propuesta 4 – Colores del Pilón", "Polleras de colores vivos para el desfile."),
    ],
    5: [
        ("Los Juglares del Valle (ficticia)", "Agrupación con acordeón, caja y guacharaca."),
        ("Conjunto Acordeón y Caja (ficticio)", "Conjunto tradicional de la provincia."),
        ("Los Herederos de la Sierra (ficticia)", "Agrupación de música vallenata clásica."),
        ("Agrupación Sabana Nueva (ficticia)", "Nueva ola vallenata con fusión."),
        ("Los Parranderos del Río (ficticia)", "Agrupación de parranda y tradición oral."),
        ("Conjunto Tierra de Cantores (ficticio)", "Conjunto de cantores y compositores."),
    ],
    6: [
        ("Semillero Notas del Mañana (ficticio)", "Niños y jóvenes de 10 a 17 años."),
        ("Los Pequeños Juglares (ficticio)", "Agrupación infantil de acordeoneros."),
        ("Agrupación Raíz Joven (ficticia)", "Jóvenes intérpretes de aires tradicionales."),
    ],
    7: [
        ("Rosa Elvira Cantillo (ficticia) – Cantadora", "Guardiana de la tradición oral vallenata."),
        ("Aurelio Mendoza Ruiz (ficticio) – Decimero", "Compositor de décimas y versos improvisados."),
        ("Ana Lucía Daza Pérez (ficticia) – Gestora cultural", "Impulsora de escuelas de música."),
        ("Ramiro Arias Gutiérrez (ficticio) – Luthier", "Artesano que repara acordeones y cajas."),
    ],
    8: [("Participante 1 (ficticio)", "Única opción registrada hasta ahora.")],
}

PRESENTACION_OPCIONES = {1: "reproductor", 2: "lista", 3: "mosaico", 4: "tarjetas", 5: "compacta", 6: "tarjetas", 7: "lista"}

# Votaciones abiertas con pocos votantes: la lista de participación sigue oculta (menos de 10 votantes).
MAX_VOTANTES = {3: 7}

# Muestras instrumentales ORIGINALES generadas para el proyecto (servidas por la web en /audio/muestras/).
MUESTRAS = {
    1: ["brisas-del-guatapuri", "luna-de-valledupar", "el-pilon-de-mi-tierra", "sabanas-del-cesar", "caminos-de-la-sierra"],
    2: ["corazon-sabanero", "recuerdos-de-mi-pueblo", "la-brisa-y-el-acordeon", "cantor-de-mi-tierra"],
}
RUTA_MUESTRA = "/audio/muestras/{}.mp3"

# Pesos por opción para que haya un ganador claro en cada votación con votos.
PESOS = {1: [5, 3, 4, 2, 1], 2: [2, 5, 3, 2], 3: [4, 3, 2, 5, 2], 5: [3, 4, 2, 3, 1, 2], 7: [5, 3, 2, 2]}

# Ediciones anteriores (cerradas, resultados publicados): año → [(categoría, descripción, ícono, votaciones)]
# votación = (título, descripción, ícono, [(opción, descripción)], pesos)
PASADAS = {
    2026: [
        ("Música", "Canciones que el público eligió en la edición 2026.", "music-note-beamed", [
            ("Canción favorita del público", "Votación cerrada de la edición 2026.", "music-note-beamed", [
                ("'Amanecer en el Cesar' (ficticia)", "Paseo vallenato."),
                ("'La Parranda de Mi Viejo' (ficticia)", "Merengue tradicional."),
                ("'Río de Recuerdos' (ficticia)", "Son romántico."),
                ("'Acordeón de mi Tierra' (ficticia)", "Puya alegre."),
            ], [4, 2, 3, 1]),
        ]),
        ("Piloneras", "Comparsas del desfile de Piloneras 2026.", "people-fill", [
            ("Mejor comparsa de Piloneras", "Votación cerrada de la edición 2026.", "people-fill", [
                ("Comparsa Brisas del Valle (ficticia)", "Coreografía tradicional."),
                ("Comparsa Tambores del Cesar (ficticia)", "Homenaje a la percusión."),
                ("Comparsa Flor de Pilón (ficticia)", "Vestuario artesanal."),
            ], [2, 3, 2]),
        ]),
    ],
    2025: [
        ("Música", "Canciones que el público eligió en la edición 2025.", "music-note-beamed", [
            ("Canción favorita del público", "Votación cerrada de la edición 2025.", "music-note-beamed", [
                ("'Sombrero Vueltiao' (ficticia)", "Paseo vallenato."),
                ("'Noches de Valledupar' (ficticia)", "Merengue romántico."),
                ("'El Viejo Guatapurí' (ficticia)", "Son nostálgico."),
            ], [3, 4, 2]),
            ("Canción inédita revelación", "Votación cerrada de la edición 2025.", "vinyl-fill", [
                ("'Camino a La Mina' (ficticia)", "Canción inédita, aire de paseo."),
                ("'Versos del Río' (ficticia)", "Canción inédita, aire de son."),
            ], [3, 2]),
        ]),
        ("Agrupaciones", "Conjuntos que se presentaron en 2025.", "boombox-fill", [
            ("Agrupación favorita", "Votación cerrada de la edición 2025.", "boombox-fill", [
                ("Los Cantores del Llano (ficticia)", "Conjunto tradicional."),
                ("Agrupación Raíz Vallenata (ficticia)", "Nueva ola vallenata."),
                ("Los Juglares de la Sierra (ficticia)", "Música clásica vallenata."),
            ], [2, 2, 3]),
        ]),
    ],
}

# Un banner por edición: año → (título, subtítulo, botón, enlace, texto alternativo, colores del degradado)
BANNERS = {
    2027: ("60.º Festival de la Leyenda Vallenata 2027", "Tu voz también hace parte de la leyenda: vota por tus favoritos.",
           "Ver votaciones", "/2027",
           "Ilustración abstracta en rojo, negro y dorado inspirada en los fuelles del acordeón.", ((221, 51, 51), (20, 20, 20))),
    2026: ("59.º Festival de la Leyenda Vallenata 2026", "Consulta los resultados de las votaciones del público de 2026.",
           "Ver resultados 2026", "/2026",
           "Ilustración abstracta en negro y dorado con ondas que evocan el sonido del acordeón.", ((20, 20, 20), (120, 80, 30))),
    2025: ("58.º Festival de la Leyenda Vallenata 2025", "Revive las votaciones del público de la edición 2025.",
           "Ver resultados 2025", "/2025",
           "Ilustración abstracta en dorado y rojo oscuro con fuelles de acordeón.", ((125, 39, 16), (60, 40, 20))),
}

REDES = [
    ("Facebook", "https://www.facebook.com/pages/Festival-de-la-Leyenda-Vallenata/112408762110846", "facebook"),
    ("X", "https://x.com/FESVALLENATO", "twitter-x"),
    ("Instagram", "https://www.instagram.com/fesvallenato/", "instagram"),
    ("YouTube", "https://www.youtube.com/channel/UCEB34mUTorkyVnDxgNDCreA", "youtube"),
]


def imagen_banner(colores, variante):
    """Imagen original 1600×600: degradado de marca con un patrón de fuelles/ondas dorado (sin fotos ni logos)."""
    ancho, alto = 1600, 600
    (r1, g1, b1), (r2, g2, b2) = colores
    img = Image.new("RGB", (ancho, alto))
    pinta = ImageDraw.Draw(img)
    for x in range(ancho):
        t = x / (ancho - 1)
        pinta.line([(x, 0), (x, alto)], fill=(int(r1 + (r2 - r1) * t), int(g1 + (g2 - g1) * t), int(b1 + (b2 - b1) * t)))
    dorado = (215, 172, 112)
    if variante == 0:  # fuelles del acordeón
        for i, x in enumerate(range(900, ancho, 46)):
            pinta.line([(x, 60), (x + 23, alto // 2), (x, alto - 60)], fill=dorado, width=5 if i % 2 else 3)
    else:  # ondas sonoras
        for k in range(7):
            base = 120 + k * 60
            puntos = [(x, base + 28 * ((x // 40) % 2 * 2 - 1)) for x in range(820, ancho + 40, 40)]
            pinta.line(puntos, fill=dorado, width=3)
    salida = io.BytesIO()
    img.save(salida, "WEBP", quality=82)
    return ContentFile(salida.getvalue())


NOMBRES = ["Andrés", "Camila", "Luis", "Daniela", "Jorge", "Mariana", "Carlos", "Laura", "Felipe", "Paola",
           "Sergio", "Natalia", "Diego", "Juliana", "Óscar", "Yuliana"]
APELLIDOS = ["Quintero", "Barros", "Zuleta", "Romero", "Castro", "Fuentes", "Ariza", "Molina", "Peñaloza",
             "Vega", "Suárez", "Montaño"]

ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def sin_tildes(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def usuarios_demo():
    return Usuario.objects.filter(email__in=[ADMIN["email"], VOTANTE["email"]]) | Usuario.objects.filter(
        email__endswith=f"@{DOMINIO_FICTICIOS}"
    )


class Command(BaseCommand):
    help = "Carga datos de demostración ilustrativos (ediciones, categorías, votaciones, opciones, usuarios y votos)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reiniciar", action="store_true",
            help="Elimina los datos de demostración existentes (y los votos en esas ediciones) antes de cargarlos.",
        )

    @transaction.atomic
    def handle(self, *args, **opciones):
        anios = [e["anio"] for e in EDICIONES]
        if opciones["reiniciar"]:
            self.borrar(anios)
        elif Edicion.objects.filter(anio__in=anios).exists() or usuarios_demo().exists():
            self.stdout.write(self.style.WARNING(
                "Los datos de demostración ya están cargados. Usa --reiniciar para volver a cargarlos."
            ))
            return
        resumen = self.cargar()
        self.stdout.write(self.style.SUCCESS(
            "Datos de demostración cargados: " + ", ".join(f"{n} {k}" for k, n in resumen.items()) + "."
        ))

    def borrar(self, anios):
        ediciones = Edicion.objects.filter(anio__in=anios)
        demo = usuarios_demo()
        Voto.objects.filter(votacion__categoria__edicion__in=ediciones).delete()
        Voto.objects.filter(usuario__in=demo).delete()
        # Los banners pertenecen a una edición (PROTECT): se borran todos los de las ediciones de demostración.
        for banner in BannerInicio.objects.filter(edicion__in=ediciones):
            banner.imagen.delete(save=False)
            banner.delete()
        RedSocial.objects.all().delete()
        ConfiguracionSitio.objects.all().delete()
        Opcion.objects.filter(votacion__categoria__edicion__in=ediciones).delete()
        Votacion.objects.filter(categoria__edicion__in=ediciones).delete()
        Categoria.objects.filter(edicion__in=ediciones).delete()
        ediciones.delete()
        RegistroAuditoria.objects.filter(usuario__in=demo).delete()
        demo.delete()

    def cargar(self):
        ahora = timezone.now().replace(second=0, microsecond=0)
        rnd = random.Random(2027)

        def relativa(dias, horas=0):
            return ahora + timedelta(days=dias, hours=horas)

        # Si hay otra edición activa (creada por un administrador), la demostración toma su lugar.
        Edicion.objects.filter(estado=Edicion.Estado.ACTIVA).exclude(anio__in=[e["anio"] for e in EDICIONES]).update(
            estado=Edicion.Estado.CERRADA
        )
        ediciones = {e["anio"]: Edicion.objects.create(**e) for e in EDICIONES}
        activa = ediciones[ANIO_ACTIVO]

        categorias = {
            nombre: Categoria.objects.create(edicion=activa, nombre=nombre, descripcion=desc, icono=icono, orden=i)
            for i, (nombre, desc, icono) in enumerate(CATEGORIAS, start=1)
        }

        votaciones = {}
        for clave, cat, titulo, desc, apertura, cierre, visibilidad, icono, publicada in VOTACIONES:
            votaciones[clave] = Votacion.objects.create(
                categoria=categorias[cat], titulo=titulo, descripcion=desc, imagen=URL_ICONO.format(icono),
                fecha_apertura=relativa(*apertura), fecha_cierre=relativa(*cierre), votos_por_usuario=1,
                visibilidad_resultados=visibilidad, publicada=publicada,
                presentacion_opciones=PRESENTACION_OPCIONES.get(clave, Votacion.PresentacionOpciones.TARJETAS),
            )

        opciones = {}
        for clave, lista in OPCIONES.items():
            opciones[clave] = [
                Opcion.objects.create(
                    votacion=votaciones[clave], nombre=nombre, descripcion=desc, orden=i,
                    enlace_multimedia=RUTA_MUESTRA.format(MUESTRAS[clave][i - 1]) if clave in MUESTRAS else "",
                    texto_audio=f"Muestra instrumental original (sin letra) de {nombre}. {desc}" if clave in MUESTRAS else "",
                )
                for i, (nombre, desc) in enumerate(lista, start=1)
            ]

        # Contraseñas asignadas con set_password (sin validadores): son credenciales de demostración.
        admin = Usuario(email=ADMIN["email"], nombres=ADMIN["nombres"], apellidos=ADMIN["apellidos"],
                        rol=Usuario.Rol.ADMINISTRADOR, is_staff=True, acepta_tratamiento_datos=True,
                        tipo_documento=Usuario.TipoDocumento.CC, numero_documento="1000000001", correo_verificado=True,
                        fecha_registro=relativa(-60))
        admin.set_password(ADMIN["password"])
        admin.save()
        votante = Usuario(email=VOTANTE["email"], nombres=VOTANTE["nombres"], apellidos=VOTANTE["apellidos"],
                          acepta_tratamiento_datos=True, tipo_documento=Usuario.TipoDocumento.CC,
                          numero_documento="1000000002", correo_verificado=True, fecha_registro=relativa(-20))
        votante.set_password(VOTANTE["password"])
        votante.save()

        # Votantes ficticios: comparten un mismo hash para que la carga sea rápida.
        clave_ficticios = make_password(CLAVE_FICTICIOS)
        ficticios = []
        for i in range(NUM_FICTICIOS):
            nombre = NOMBRES[i % len(NOMBRES)]
            apellido = rnd.choice(APELLIDOS)
            correo = f"{sin_tildes(nombre).lower()}.{sin_tildes(apellido).lower()}{i}@{DOMINIO_FICTICIOS}"
            ficticios.append(Usuario(
                email=correo, nombres=nombre, apellidos=apellido, password=clave_ficticios,
                acepta_tratamiento_datos=True, fecha_registro=relativa(-rnd.randint(1, 40)),
                # Documentos ficticios fuera del rango de los demo (1000000001 y 1000000002)
                tipo_documento=Usuario.TipoDocumento.CC, numero_documento=str(1100000000 + i), correo_verificado=True,
            ))
        Usuario.objects.bulk_create(ficticios)
        # MySQL no devuelve las claves primarias en bulk_create: se vuelven a leer en el mismo orden.
        por_correo = Usuario.objects.in_bulk([u.email for u in ficticios], field_name="email")
        ficticios = [por_correo[u.email] for u in ficticios]

        usados = set(Voto.objects.values_list("codigo_comprobante", flat=True)) | {COMPROBANTE_VOTANTE_DEMO}

        def codigo(anio=ANIO_ACTIVO):
            while True:
                valor = f"FLV{anio % 100:02d}-" + "".join(rnd.choice(ALFABETO) for _ in range(6))
                if valor not in usados:
                    usados.add(valor)
                    return valor

        tope = ahora - timedelta(hours=1)
        a_votar = [(votaciones[c], opciones[c], pesos, ANIO_ACTIVO, MAX_VOTANTES.get(c)) for c, pesos in PESOS.items()]
        a_votar += [(*fila, None) for fila in self.cargar_pasadas(ediciones)]
        votos, fechas = [], []
        for votacion, lista_opciones, pesos, anio, maximo in a_votar:
            desde = votacion.fecha_apertura
            hasta = min(votacion.fecha_cierre, tope)
            for usuario in ficticios[:maximo]:
                if rnd.random() < 0.3:  # ~70 % de participación
                    continue
                opcion = rnd.choices(lista_opciones, weights=pesos)[0]
                votos.append(Voto(usuario=usuario, votacion=votacion, opcion=opcion, codigo_comprobante=codigo(anio)))
                fechas.append(desde + (hasta - desde) * rnd.random())
        # La votante demo ya votó en una votación cerrada (para «Mis votos»).
        votos.append(Voto(usuario=votante, votacion=votaciones[7], opcion=opciones[7][0],
                          codigo_comprobante=COMPROBANTE_VOTANTE_DEMO))
        fechas.append(relativa(-12))
        Voto.objects.bulk_create(votos, batch_size=500)
        # `fecha_hora` es auto_now_add: se ajusta después para repartir los votos en el periodo de cada votación.
        fecha_por_codigo = {v.codigo_comprobante: f for v, f in zip(votos, fechas)}
        guardados = list(Voto.objects.filter(codigo_comprobante__in=fecha_por_codigo))
        for voto in guardados:
            voto.fecha_hora = fecha_por_codigo[voto.codigo_comprobante]
        Voto.objects.bulk_update(guardados, ["fecha_hora"], batch_size=500)

        registros = [
            ("publicar", "votacion", votaciones[1], {"titulo": votaciones[1].titulo}, relativa(-6)),
            ("cerrar", "votacion", votaciones[2], {"titulo": votaciones[2].titulo}, relativa(-3)),
            ("publicar", "votacion", votaciones[3], {"titulo": votaciones[3].titulo}, relativa(-3, 1)),
            ("crear", "votacion", votaciones[6], {"titulo": votaciones[6].titulo}, relativa(-2)),
            ("actualizar", "categoria", categorias["Vestuario"], {"nombre": "Vestuario"}, relativa(-1)),
        ]
        for accion, entidad, obj, detalle, fecha in registros:
            registro = RegistroAuditoria.objects.create(
                usuario=admin, accion=accion, entidad=entidad, entidad_id=str(obj.pk), detalle=detalle
            )
            RegistroAuditoria.objects.filter(pk=registro.pk).update(fecha_hora=fecha)

        self.cargar_sitio(ediciones)

        return {
            "ediciones": len(ediciones), "categorías": len(categorias), "votaciones": len(votaciones),
            "opciones": sum(len(v) for v in opciones.values()), "usuarios": 2 + len(ficticios), "votos": len(votos),
        }

    def cargar_pasadas(self, ediciones):
        """Ediciones cerradas con votaciones cerradas y resultados publicados. Devuelve lo que se debe votar."""
        a_votar = []
        for anio, categorias in PASADAS.items():
            apertura = timezone.make_aware(datetime(anio, 4, 1, 8, 0))
            cierre = timezone.make_aware(datetime(anio, 4, 30, 18, 0))
            for i, (nombre, desc, icono, votaciones) in enumerate(categorias, start=1):
                categoria = Categoria.objects.create(edicion=ediciones[anio], nombre=nombre, descripcion=desc, icono=icono, orden=i)
                for titulo, desc_v, icono_v, lista, pesos in votaciones:
                    votacion = Votacion.objects.create(
                        categoria=categoria, titulo=titulo, descripcion=desc_v, imagen=URL_ICONO.format(icono_v),
                        fecha_apertura=apertura, fecha_cierre=cierre, publicada=True, resultados_publicados=True,
                        presentacion_opciones=Votacion.PresentacionOpciones.LISTA,
                    )
                    ops = [Opcion.objects.create(votacion=votacion, nombre=n, descripcion=d, orden=j)
                           for j, (n, d) in enumerate(lista, start=1)]
                    a_votar.append((votacion, ops, pesos, anio))
        return a_votar

    def cargar_sitio(self, ediciones):
        """Datos de contacto, redes sociales y un banner del inicio por edición."""
        ConfiguracionSitio.obtener()
        if not RedSocial.objects.exists():
            for orden, (nombre, url, icono) in enumerate(REDES, start=1):
                RedSocial.objects.create(nombre=nombre, url=url, icono=icono, orden=orden)
        for variante, (anio, (titulo, subtitulo, boton, enlace, alt, colores)) in enumerate(BANNERS.items()):
            banner = BannerInicio(edicion=ediciones[anio], titulo=titulo, subtitulo=subtitulo, texto_boton=boton, enlace_boton=enlace,
                                  texto_alternativo=alt, orden=1)
            banner.imagen.storage.delete(f"banners/demo-{anio}.webp")  # nombre estable entre recargas
            banner.imagen.save(f"demo-{anio}.webp", imagen_banner(colores, variante % 2), save=False)
            banner.save()

