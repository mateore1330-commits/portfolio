import { MarcaCambio } from '@/admin/comun/Campo.jsx'
import { parrafosCambiados } from '@/admin/comun/useFormulario.js'

// Lo que se repite con varios campos dentro: los apartados de las páginas legales, los
// proyectos y la experiencia del CV, los grupos de habilidades… Cada uno en su tarjeta, con
// "Quitar" y la marca de cambio; abajo, "+ Añadir".
// children(elemento, i): los campos de cada tarjeta.
// Con alQuitar/alAnadir propios (el CV: quitar o añadir en los dos idiomas a la vez).
export default function ListaBloques({
  valor,
  original = [],
  alCambiar,
  nuevo,
  nombre,
  anadir,
  alQuitar,
  alAnadir,
  children,
}) {
  const cambiados = parrafosCambiados(valor, original)
  const quitar = alQuitar ?? ((i) => alCambiar(valor.filter((_, j) => j !== i)))
  const sumar = alAnadir ?? (() => alCambiar([...valor, structuredClone(nuevo)]))
  const quitados = cambiados.length - valor.length

  return (
    <div className="lista-bloques">
      {valor.map((elemento, i) => (
        <div className={`tarjeta bloque-lista${cambiados[i] ? ' cambiado' : ''}`} key={i}>
          <div className="cab-bloque">
            <span className="mono">
              {nombre} {i + 1}
            </span>
            {cambiados[i] && <MarcaCambio />}
            <button className="enlace borrar" type="button" onClick={() => quitar(i)}>
              Quitar
            </button>
          </div>
          {children(elemento, i)}
        </div>
      ))}
      {quitados > 0 && !alQuitar && (
        <p className="marca-cambio quitados">
          • {quitados === 1 ? 'Quitado 1' : `Quitados ${quitados}`}
          <button className="deshacer" type="button" onClick={() => alCambiar(original)}>
            ↺ Deshacer
          </button>
        </p>
      )}
      <button className="anadir" type="button" onClick={sumar}>
        {anadir}
      </button>
    </div>
  )
}
