import { useEffect, useId, useRef } from 'react'
import { MarcaCambio } from '@/admin/comun/Campo.jsx'
import { parrafosCambiados } from '@/admin/comun/useFormulario.js'

// Una lista de párrafos (Descripción, Mi papel, Lo que aprendí…): "+ Añadir", "×" para
// quitar y la marca de cambio en cada párrafo. Ordenarlos arrastrando llega en ADM-09: de
// momento, en el sitio del asa ⋮⋮ va su número.
// errores: { índice: 'texto del error' }.
export default function ListaParrafos({ etiqueta, valor, original = [], errores = {}, alCambiar }) {
  const base = useId()
  const cambiados = parrafosCambiados(valor, original)
  const enfocar = useRef(null)

  // Tras "+ Añadir", el cursor va al párrafo nuevo.
  useEffect(() => {
    if (enfocar.current === null) return
    document.getElementById(`${base}-${enfocar.current}`)?.focus()
    enfocar.current = null
  })

  const poner = (i, texto) => alCambiar(valor.map((p, j) => (j === i ? texto : p)))
  const quitar = (i) => alCambiar(valor.filter((_, j) => j !== i))
  // Deshacer un párrafo que ya estaba lo devuelve a su texto; uno nuevo, lo quita.
  const deshacer = (i) => (i < original.length ? poner(i, original[i]) : quitar(i))

  return (
    <div className="campo-panel">
      <p className="etiqueta">{etiqueta}</p>
      <div className="lista-editable">
        {valor.map((texto, i) => {
          const id = `${base}-${i}`
          const error = errores[i]
          const clases = ['item', cambiados[i] && 'cambiado', error && 'mal'].filter(Boolean).join(' ')
          return (
            <div className={clases} key={i}>
              <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <textarea
                id={id}
                rows={2}
                value={texto}
                aria-label={`${etiqueta} ${i + 1}`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => poner(i, e.target.value)}
              />
              <button type="button" aria-label={`Quitar ${etiqueta.toLowerCase()} ${i + 1}`} onClick={() => quitar(i)}>
                ×
              </button>
              {cambiados[i] && <MarcaCambio alDeshacer={() => deshacer(i)} />}
              {error && (
                <p className="err" id={`${id}-error`}>
                  {error}
                </p>
              )}
            </div>
          )
        })}
        {/* Párrafos quitados que existían: también son cambios y se pueden recuperar. */}
        {cambiados.length > valor.length && (
          <p className="marca-cambio quitados">
            • {cambiados.length - valor.length === 1 ? 'Quitado 1 párrafo' : `Quitados ${cambiados.length - valor.length} párrafos`}
            <button className="deshacer" type="button" onClick={() => alCambiar(original)}>
              ↺ Deshacer
            </button>
          </p>
        )}
        <button
          className="anadir"
          type="button"
          onClick={() => {
            enfocar.current = valor.length
            alCambiar([...valor, ''])
          }}
        >
          + Añadir
        </button>
      </div>
    </div>
  )
}
