import { useEffect, useId, useRef } from 'react'
import AreaTexto from '@/admin/comun/AreaTexto.jsx'
import { MarcaCambio } from '@/admin/comun/Campo.jsx'
import { parrafosCambiados } from '@/admin/comun/useFormulario.js'

// Una lista que crece: "+ Añadir", "×" para quitar y la marca de cambio en cada elemento.
// Ordenarla arrastrando llega en ADM-09: de momento, en el sitio del asa ⋮⋮ va su número.
// - Párrafos (Descripción, Lo que aprendí…): cuadros que crecen solos.
// - lineas: textos cortos de una línea (las etiquetas de la portada).
// - pares: [{ clave, etiqueta }] → cada elemento es un objeto con esos campos, en fila
//   (la ficha de la portada: dato · valor).
// errores: { índice: 'texto del error' }.
export default function ListaParrafos({
  etiqueta,
  valor,
  original = [],
  errores = {},
  alCambiar,
  lineas = false,
  pares = null,
  ayuda,
  anadir = '+ Añadir',
}) {
  const base = useId()
  const cambiados = parrafosCambiados(valor, original)
  const enfocar = useRef(null)

  // Tras "+ Añadir", el cursor va al elemento nuevo.
  useEffect(() => {
    if (enfocar.current === null) return
    document.getElementById(`${base}-${enfocar.current}`)?.focus()
    enfocar.current = null
  })

  const poner = (i, nuevo) => alCambiar(valor.map((p, j) => (j === i ? nuevo : p)))
  const quitar = (i) => alCambiar(valor.filter((_, j) => j !== i))
  // Deshacer uno que ya estaba lo devuelve a como estaba; uno nuevo, lo quita.
  const deshacer = (i) => (i < original.length ? poner(i, original[i]) : quitar(i))
  const vacio = pares ? Object.fromEntries(pares.map((c) => [c.clave, ''])) : ''
  const quitados = cambiados.length - valor.length

  return (
    <div className="campo-panel">
      <p className="etiqueta">{etiqueta}</p>
      <div className="lista-editable">
        {valor.map((elemento, i) => {
          const id = `${base}-${i}`
          const error = errores[i]
          const describir = error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}
          const clases = ['item', cambiados[i] && 'cambiado', error && 'mal'].filter(Boolean).join(' ')
          let control
          if (pares) {
            control = (
              <div className="fila-campos par">
                {pares.map((c, k) => (
                  <input
                    key={c.clave}
                    id={k === 0 ? id : undefined}
                    type="text"
                    value={elemento[c.clave]}
                    aria-label={`${c.etiqueta} ${i + 1}`}
                    onChange={(e) => poner(i, { ...elemento, [c.clave]: e.target.value })}
                    {...describir}
                  />
                ))}
              </div>
            )
          } else if (lineas) {
            control = (
              <input
                id={id}
                type="text"
                value={elemento}
                aria-label={`${etiqueta} ${i + 1}`}
                onChange={(e) => poner(i, e.target.value)}
                {...describir}
              />
            )
          } else {
            control = (
              <AreaTexto
                id={id}
                value={elemento}
                aria-label={`${etiqueta} ${i + 1}`}
                onChange={(e) => poner(i, e.target.value)}
                {...describir}
              />
            )
          }
          return (
            <div className={clases} key={i}>
              <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              {control}
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
        {/* Elementos quitados que existían: también son cambios y se pueden recuperar. */}
        {quitados > 0 && (
          <p className="marca-cambio quitados">
            • {quitados === 1 ? 'Quitado 1' : `Quitados ${quitados}`}
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
            alCambiar([...valor, vacio])
          }}
        >
          {anadir}
        </button>
      </div>
      {ayuda && <p className="ayuda">{ayuda}</p>}
    </div>
  )
}
