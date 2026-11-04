// Los estados que se repiten en todas las pantallas (ADM-00): la cabecera, cargando,
// vacío y los avisos en banda. Nunca una pantalla en blanco.

export function Cabecera({ titulo, texto, children }) {
  return (
    <div className="cab">
      <div>
        <h1>{titulo}</h1>
        {texto && <p>{texto}</p>}
      </div>
      {children && <div className="acciones">{children}</div>}
    </div>
  )
}

// Huecos grises mientras llegan los datos: con la forma de las tarjetas que vendrán.
export function TarjetasCargando({ cuantas = 3 }) {
  return (
    <div className="rejilla" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: cuantas }, (_, i) => (
        <div className="tarjeta" key={i}>
          <span className="hueco grande" />
          <span className="hueco" />
          <span className="hueco corto" />
        </div>
      ))}
    </div>
  )
}

export function Vacio({ icono = '◌', titulo, children }) {
  return (
    <div className="vacio">
      <span className="icono" aria-hidden="true">
        {icono}
      </span>
      <h2>{titulo}</h2>
      {children}
    </div>
  )
}

// tipo: 'aviso' | 'error' | 'ok' | 'info'
export function Banda({ tipo = 'info', children, acciones }) {
  return (
    <div className={`banda ${tipo === 'error' ? 'mal' : tipo}`} role={tipo === 'error' ? 'alert' : undefined}>
      <span>{children}</span>
      {acciones && <div className="acciones">{acciones}</div>}
    </div>
  )
}
