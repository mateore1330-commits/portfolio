import { useState } from 'react'

// Fichas de texto libre (las habilidades del CV, decidido en ADM-04): escribes y pulsas
// Intro (o una coma) para añadir. Con el campo vacío, Borrar quita la última.
export default function FichasLibres({ id, valor, alCambiar, placeholder = 'Añadir…', describir }) {
  const [texto, setTexto] = useState('')

  const anadir = () => {
    const nueva = texto.trim()
    if (nueva && !valor.includes(nueva)) alCambiar([...valor, nueva])
    setTexto('')
  }

  return (
    <div className="fichas">
      {valor.map((ficha) => (
        <span key={ficha}>
          {ficha}
          <button type="button" aria-label={`Quitar ${ficha}`} onClick={() => alCambiar(valor.filter((f) => f !== ficha))}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={texto}
        placeholder={placeholder}
        aria-describedby={describir}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={anadir}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            anadir()
          } else if (e.key === 'Backspace' && texto === '' && valor.length > 0) {
            alCambiar(valor.slice(0, -1))
          }
        }}
      />
    </div>
  )
}
