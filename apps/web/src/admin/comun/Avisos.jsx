import { useCallback, useState } from 'react'
import { AvisosContext } from '@/admin/comun/avisos.js'

const DURACION = 4000
let siguienteId = 0

// Los avisos breves de abajo a la derecha ("✓ Guardado"). La zona es role="status": el
// lector de pantalla los lee sin mover el foco.
export default function Avisos({ children }) {
  const [lista, setLista] = useState([])

  const quitar = useCallback((id) => setLista((l) => l.filter((a) => a.id !== id)), [])

  const avisar = useCallback(
    (tipo, texto) => {
      const id = ++siguienteId
      setLista((l) => [...l, { id, tipo, texto }])
      setTimeout(() => quitar(id), DURACION)
    },
    [quitar],
  )

  return (
    <AvisosContext.Provider value={avisar}>
      {children}
      <div className="toasts" role="status">
        {lista.map((a) => (
          <p key={a.id} className={`toast ${a.tipo === 'error' ? 'mal' : a.tipo}`}>
            <b aria-hidden="true">{a.tipo === 'ok' ? '✓' : '✕'}</b>
            {a.texto}
            <button className="enlace gris" type="button" onClick={() => quitar(a.id)} aria-label="Cerrar el aviso">
              ×
            </button>
          </p>
        ))}
      </div>
    </AvisosContext.Provider>
  )
}
