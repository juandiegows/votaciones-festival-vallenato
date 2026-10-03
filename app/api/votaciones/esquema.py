def sin_alias_admin(endpoints):
    """Quita del esquema OpenAPI el alias /api/admin/ (la administración se documenta en /api/gestion/)."""
    return [e for e in endpoints if not e[0].startswith("/api/admin/")]
