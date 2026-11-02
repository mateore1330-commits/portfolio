import { MarcaCambio } from '@/admin/comun/Campo.jsx'
import { permutar, useClaves } from '@/admin/comun/orden.js'
import ListaOrdenable, { Asa, Ordenable } from '@/admin/comun/Ordenable.jsx'
import { parrafosCambiados } from '@/admin/comun/useFormulario.js'

// Lo que se repite con varios campos dentro: los apartados de las páginas legales, los
// proyectos y la experiencia del CV, los grupos de habilidades… Cada uno en su tarjeta, con
// "Quitar" y la marca de cambio; abajo, "+ Añadir". Se ordenan arrastrando el asa ⋮⋮ de su
// cabecera (ADM-09): como un cambio más del formulario, que se guarda con Guardar.
// children(elemento, i): los campos de cada tarjeta.
// Con alQuitar/alAnadir/alMover propios (el CV: en los dos idiomas a la vez).
// alMover(permutar): permutar(lista) devuelve esa lista en el orden nuevo.
export default function ListaBloques({
  valor,
  original = [],
  alCambiar,
  nuevo,
  nombre,
  anadir,
  alQuitar,
  alAnadir,
  alMover,
  children,
}) {
  const cambiados = parrafosCambiados(valor, original)
  const [claves, setClaves] = useClaves(valor.length)
  const quitar = (i) => {
    setClaves(claves.filter((_, j) => j !== i))
    if (alQuitar) alQuitar(i)
    else alCambiar(valor.filter((_, j) => j !== i))
  }
  const mover = (orden) => {
    const cambiar = (lista) => permutar(lista, claves, orden)
    if (alMover) alMover(cambiar)
    else alCambiar(cambiar(valor))
    setClaves(orden)
  }
  const sumar = alAnadir ?? (() => alCambiar([...valor, structuredClone(nuevo)]))
  const quitados = cambiados.length - valor.length

  return (
    <div className="lista-bloques">
      <ListaOrdenable ids={claves} nombre={(c) => `${nombre.toLowerCase()} ${claves.indexOf(c) + 1}`} alMover={mover}>
        {valor.map((elemento, i) => (
          <Ordenable className={`tarjeta bloque-lista${cambiados[i] ? ' cambiado' : ''}`} key={claves[i]} id={claves[i]}>
            <div className="cab-bloque">
              <Asa nombre={`${nombre.toLowerCase()} ${i + 1}`} />
              <span className="mono">
                {nombre} {i + 1}
              </span>
              {cambiados[i] && <MarcaCambio />}
              <button className="enlace borrar" type="button" onClick={() => quitar(i)}>
                Quitar
              </button>
            </div>
            {children(elemento, i)}
          </Ordenable>
        ))}
      </ListaOrdenable>
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
