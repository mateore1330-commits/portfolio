import { useEffect, useId, useRef } from 'react'
import AreaTexto from '@/panel/comun/AreaTexto.jsx'
import { MarcaCambio, MarcaRevisar } from '@/panel/comun/Campo.jsx'
import { permutar, useClaves } from '@/panel/comun/orden.js'
import ListaOrdenable, { Asa, Ordenable } from '@/panel/comun/Ordenable.jsx'
import { parrafosCambiados } from '@/panel/comun/useFormulario.js'

// Una lista que crece: "+ Añadir", "×" para quitar y la marca de cambio en cada elemento.
// Se ordena arrastrando el asa ⋮⋮ (ADM-09). Moverlos no guarda: es un cambio más del
// formulario, con su marca, y se guarda con Guardar.
// - Párrafos (Descripción, Lo que aprendí…): cuadros que crecen solos.
// - lineas: textos cortos de una línea (las etiquetas de la portada).
// - pares: [{ clave, etiqueta }] → cada elemento es un objeto con esos campos, en fila
//   (la ficha de la portada: dato · valor).
// errores: { índice: 'texto del error' }.
// revisar: el idioma cambiado si esta lista se cambió en el otro y aquí no (#185).
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
  revisar = null,
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

  const [claves, setClaves] = useClaves(valor.length)
  const poner = (i, nuevo) => alCambiar(valor.map((p, j) => (j === i ? nuevo : p)))
  const quitar = (i) => {
    setClaves(claves.filter((_, j) => j !== i))
    alCambiar(valor.filter((_, j) => j !== i))
  }
  const mover = (orden) => {
    alCambiar(permutar(valor, claves, orden))
    setClaves(orden)
  }
  // Deshacer uno que ya estaba lo devuelve a como estaba; uno nuevo, lo quita. Si lo que
  // había en su sitio se ha movido a otro, vuelve aquí (cambian de sitio): así deshacer un
  // orden nunca repite ni pierde un texto.
  const deshacer = (i) => {
    if (i >= original.length) return quitar(i)
    const j = valor.findIndex((p, k) => k !== i && JSON.stringify(p) === JSON.stringify(original[i]) && cambiados[k])
    if (j === -1) return poner(i, original[i])
    const sitio = (lista) => lista.map((x, k) => (k === i ? lista[j] : k === j ? lista[i] : x))
    alCambiar(sitio(valor))
    setClaves(sitio(claves))
  }
  // Para el lector de pantalla: el principio del texto.
  const nombreDe = (clave) => {
    const i = claves.indexOf(clave)
    const texto = (pares ? valor[i]?.[pares[0].clave] : valor[i])?.trim()
    return texto ? `«${texto.length > 40 ? `${texto.slice(0, 40)}…` : texto}»` : `${etiqueta} ${i + 1}`
  }
  const vacio = pares ? Object.fromEntries(pares.map((c) => [c.clave, ''])) : ''
  const quitados = cambiados.length - valor.length

  return (
    <div className={`campo-panel${revisar ? ' por-revisar' : ''}`}>
      <p className="etiqueta">
        {etiqueta}
        {revisar && <MarcaRevisar idioma={revisar} />}
      </p>
      <div className="lista-editable">
        <ListaOrdenable ids={claves} nombre={nombreDe} alMover={mover}>
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
              <Ordenable className={clases} key={claves[i]} id={claves[i]}>
                <Asa nombre={`${etiqueta.toLowerCase()} ${i + 1}`} />
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
              </Ordenable>
            )
          })}
        </ListaOrdenable>
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
