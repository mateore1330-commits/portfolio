import { useEffect, useId, useRef } from 'react'

// El diálogo del panel, con el <dialog> del navegador: mientras está abierto, lo de detrás
// no se puede tocar ni recorrer con Tab, y al cerrarse el foco vuelve al botón que lo abrió.
// Esc y un clic fuera lo cierran, salvo con cerrable={false} (la sesión caducada).
export default function Dialogo({ abierto, titulo, alCerrar, cerrable = true, children }) {
  const ref = useRef(null)
  const idTitulo = useId()

  useEffect(() => {
    const dialogo = ref.current
    if (abierto && !dialogo.open) {
      dialogo.showModal()
      // El <dialog> enfoca lo primero que encuentra; data-enfoque elige otra cosa (el
      // autoFocus de React no le llega: React no pone el atributo en el HTML).
      dialogo.querySelector('[data-enfoque]')?.focus()
    } else if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  const cerrar = () => {
    if (cerrable) alCerrar?.()
  }

  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault()
        cerrar()
      }}
      // El <dialog> no tiene relleno: un clic en él (y no en .caja) es un clic en el velo.
      onClick={(e) => e.target === ref.current && cerrar()}
    >
      <div className="caja">
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
      </div>
    </dialog>
  )
}
