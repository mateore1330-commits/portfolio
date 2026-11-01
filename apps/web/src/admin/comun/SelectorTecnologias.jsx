import { useId, useState } from 'react'

const GRUPOS = { frontend: 'Frontend', backend: 'Backend', data: 'Datos', tools: 'Herramientas', design: 'Diseño', soft: 'Personales' }
const MAXIMO = 8

// "Vue" encuentra "vue.js"; "diseno" encuentra "Diseño".
const normal = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Las tecnologías de un proyecto, elegidas de la lista maestra (Conocimientos): fichas en
// su orden y un campo que sugiere mientras escribes. No se puede escribir una que no esté
// en la lista. Teclado: flechas para elegir, Intro para añadir, Esc para cerrar y, con el
// campo vacío, Borrar quita la última.
export default function SelectorTecnologias({ id, todas, valor, alCambiar, describir }) {
  const lista = useId()
  const [texto, setTexto] = useState('')
  const [abierta, setAbierta] = useState(false)
  const [activa, setActiva] = useState(0)

  const porId = new Map(todas.map((t) => [t.id, t]))
  const buscado = normal(texto.trim())
  const sugerencias = todas
    .filter((t) => !valor.includes(t.id) && normal(t.name).includes(buscado))
    .slice(0, MAXIMO)
  const visible = abierta && (buscado !== '' || sugerencias.length > 0)
  const indice = Math.min(activa, sugerencias.length - 1)

  const anadir = (t) => {
    alCambiar([...valor, t.id])
    setTexto('')
    setActiva(0)
  }
  const quitar = (tid) => alCambiar(valor.filter((v) => v !== tid))

  const teclas = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAbierta(true)
      const paso = e.key === 'ArrowDown' ? 1 : -1
      setActiva((a) => (Math.max(0, Math.min(a, sugerencias.length - 1)) + paso + sugerencias.length) % Math.max(sugerencias.length, 1))
    } else if (e.key === 'Enter') {
      // Intro nunca envía el formulario desde aquí.
      e.preventDefault()
      if (visible && sugerencias[indice]) anadir(sugerencias[indice])
    } else if (e.key === 'Escape' && visible) {
      // Esc cierra las sugerencias, no el diálogo ni nada de fuera.
      e.stopPropagation()
      setAbierta(false)
    } else if (e.key === 'Backspace' && texto === '' && valor.length > 0) {
      quitar(valor.at(-1))
    }
  }

  return (
    <div className="selector">
      <div className="fichas">
        {valor.map((tid) => {
          const nombre = porId.get(tid)?.name ?? '¿?'
          return (
            <span key={tid}>
              {nombre}
              <button type="button" aria-label={`Quitar ${nombre}`} onClick={() => quitar(tid)}>
                ×
              </button>
            </span>
          )
        })}
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder="Añadir tecnología…"
          value={texto}
          aria-expanded={visible}
          aria-controls={lista}
          aria-autocomplete="list"
          aria-activedescendant={visible && sugerencias[indice] ? `${lista}-${sugerencias[indice].id}` : undefined}
          aria-describedby={describir}
          onChange={(e) => {
            setTexto(e.target.value)
            setAbierta(true)
            setActiva(0)
          }}
          onFocus={() => setAbierta(true)}
          onBlur={() => setAbierta(false)}
          onKeyDown={teclas}
        />
      </div>
      <ul className="sugerencias" id={lista} role="listbox" aria-label="Tecnologías de la lista" hidden={!visible}>
        {sugerencias.map((t, i) => (
          <li
            key={t.id}
            id={`${lista}-${t.id}`}
            role="option"
            aria-selected={i === indice}
            // mousedown y no click: así el campo no pierde el foco antes de añadir.
            onMouseDown={(e) => {
              e.preventDefault()
              anadir(t)
            }}
            onMouseEnter={() => setActiva(i)}
          >
            {t.name} <small>{GRUPOS[t.category] ?? t.category}</small>
          </li>
        ))}
        {sugerencias.length === 0 && (
          <li className="nada" role="option" aria-disabled="true" aria-selected="false">
            No está en la lista. Añádela en Conocimientos (ADM-07).
          </li>
        )}
      </ul>
    </div>
  )
}
