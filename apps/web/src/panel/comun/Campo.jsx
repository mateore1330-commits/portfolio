// Un campo de formulario del panel: su nombre, la ayuda, el error en rojo y, si ha
// cambiado, la marca ámbar "• Modificado ↺ Deshacer" (aprobada en ADM-00). Si se cambió en
// el otro idioma y aquí no, la marca azul "Cambiaste el español: revísalo" (#185).
// Con `id`, el nombre es un <label> del control; sin él (interruptores, listas), un texto.
export default function Campo({ etiqueta, id, ayuda, error, cambiado, alDeshacer, revisar, children }) {
  const Nombre = id ? 'label' : 'p'
  const clases = ['campo-panel', cambiado && 'cambiado', revisar && 'por-revisar', error && 'mal'].filter(Boolean).join(' ')
  return (
    <div className={clases}>
      <Nombre className={id ? undefined : 'etiqueta'} htmlFor={id}>
        {etiqueta}
        {cambiado && <MarcaCambio alDeshacer={alDeshacer} />}
        {revisar && <MarcaRevisar idioma={revisar} />}
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

export function MarcaRevisar({ idioma }) {
  return <span className="marca-revisar">• Cambiaste el {idioma}: revísalo</span>
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
