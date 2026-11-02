const cambios = (n) => (n === 1 ? '1 cambio' : `${n} cambios`)

// Un bloque numerado de formulario (ADM-00): "01 Textos", con su explicación a la izquierda
// y "N cambios" si tiene cambios sin guardar.
export default function Bloque({ n, titulo, texto, cambios: cuantosCambios = 0, children }) {
  return (
    <section className="bloque">
      <header>
        <h2>
          <b>{n}</b>
          {titulo}
          {cuantosCambios > 0 && <span className="cuenta-cambios">{cambios(cuantosCambios)}</span>}
        </h2>
        {texto && <p>{texto}</p>}
      </header>
      <div className="campos">{children}</div>
    </section>
  )
}

// Los bloques grises con la forma del formulario, mientras llegan los datos.
export function Esqueleto({ etiqueta = 'Cargando' }) {
  return (
    <div className="esqueleto" aria-busy="true" aria-label={etiqueta}>
      {Array.from({ length: 3 }, (_, i) => (
        <section className="bloque" key={i}>
          <header>
            <span className="hueco grande" />
            <span className="hueco corto" />
          </header>
          <div className="campos">
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j}>
                <span className="hueco mini" />
                <span className="hueco alto" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
