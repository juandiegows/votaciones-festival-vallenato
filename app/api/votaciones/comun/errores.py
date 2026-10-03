class ReglaNegocioError(Exception):
    """
    Una regla de negocio impide la operación. Los servicios la lanzan sin saber nada de HTTP; el manejador de
    excepciones de DRF (comun.api.manejar_excepciones) la convierte en {"detail", "codigo"} con su código HTTP.
    """

    def __init__(self, mensaje, codigo="regla_negocio", status=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo
        self.status = status
