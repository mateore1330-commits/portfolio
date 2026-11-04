// Un campo de formulario del panel: su nombre, la ayuda, el error en rojo y, si ha
// cambiado, la marca ámbar "• Modificado ↺ Deshacer" (aprobada en ADM-00).
// Con `id`, el nombre es un <label> del control; sin él (interruptores, listas), un texto.
export default function Campo({ etiqueta, id, ayuda, error, cambiado, alDeshacer, children }) {
  const Nombre = id ? 'label' : 'p'
  const clases = ['campo-panel', cambiado && 'cambiado', error && 'mal'].filter(Boolean).join(' ')
  return (
    <div className={clases}>
      <Nombre className={id ? undefined : 'etiqueta'} htmlFor={id}>
        {etiqueta}
        {cambiado && <MarcaCambio alDeshacer={alDeshacer} />}
      </Nombre>
      {children}
      {ayuda && <p className="ayuda">{ayuda}</p>}
      {error && (
        <p className="err" id={id && `${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function MarcaCambio({ alDeshacer }) {
  return (
    <span className="marca-cambio">
      • Modificado
      {alDeshacer && (
        <button className="deshacer" type="button" onClick={alDeshacer}>
          ↺ Deshacer
        </button>
      )}
    </span>
  )
}
