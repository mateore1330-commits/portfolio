import Dialogo from '@/panel/comun/Dialogo.jsx'

// La ventana de cambiar el destacado (#154): la misma para la estrella, el arrastre y el
// interruptor del formulario. cambio: { nuevo, anterior } (nombres), o null si está cerrada.
// alGuardar: en el formulario, el cambio se aplica al guardar (y así lo dice).
export default function DialogoDestacado({ cambio, alAceptar, alCancelar, alGuardar = false }) {
  return (
    <Dialogo abierto={Boolean(cambio)} titulo="Cambiar el proyecto destacado" alCerrar={alCancelar}>
      <p>
        <b>{cambio?.nuevo}</b> pasará a ser el destacado
        {cambio?.anterior && (
          <>
            {' '}
            y <b>{cambio.anterior}</b> dejará de serlo
          </>
        )}
        .
      </p>
      <p>
        El destacado sale el primero y más grande en la portada de la web.{' '}
        {alGuardar ? 'Se aplicará al guardar.' : 'Se verá en la web al publicar.'}
      </p>
      <div className="acciones">
        <button className="boton suave" type="button" onClick={alCancelar} data-enfoque>
          Cancelar
        </button>
        <button className="boton azul" type="button" onClick={alAceptar}>
          Aceptar
        </button>
      </div>
    </Dialogo>
  )
}
