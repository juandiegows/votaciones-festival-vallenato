from django.utils.text import slugify


def filtrar_por_id(consulta, campo, valor):
    """Filtra por un ID recibido en la URL; un valor no numérico devuelve una lista vacía en lugar de un error 500."""
    if not valor:
        return consulta
    return consulta.filter(**{campo: int(valor)}) if str(valor).isdigit() else consulta.none()


def slug_unico(consulta, texto, max_length, excluir_pk=None):
    """Slug sin tildes a partir de `texto`, único dentro de `consulta` (agrega -2, -3… si se repite)."""
    base = (slugify(texto) or "item")[:max_length].strip("-")
    if excluir_pk is not None:
        consulta = consulta.exclude(pk=excluir_pk)
    candidato, n = base, 2
    while consulta.filter(slug=candidato).exists():
        sufijo = f"-{n}"
        candidato = f"{base[: max_length - len(sufijo)]}{sufijo}"
        n += 1
    return candidato
