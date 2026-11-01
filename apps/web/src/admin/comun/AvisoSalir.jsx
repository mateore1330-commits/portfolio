import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import Dialogo from '@/admin/comun/Dialogo.jsx'

// Avisa antes de perder cambios sin guardar:
// - al cerrar la pestaña o recargar, con el aviso del propio navegador;
// - al irse a otra pantalla del panel (el menú, "← Proyectos", Salir), con este diálogo.
//   El navegador no deja poner su aviso en ese caso.
export default function AvisoSalir({ cuantos }) {
  const hayCambios = cuantos > 0

  useEffect(() => {
    if (!hayCambios) return undefined
    const avisar = (e) => {
      e.preventDefault()
      // Los navegadores antiguos lo piden así; el texto no se enseña.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) => hayCambios && currentLocation.pathname !== nextLocation.pathname,
  )
  const abierto = bloqueo.state === 'blocked'

  return (
    <Dialogo abierto={abierto} titulo="Tienes cambios sin guardar" alCerrar={() => bloqueo.reset?.()}>
      <p>
        {cuantos === 1 ? 'Hay 1 cambio' : `Hay ${cuantos} cambios`} que todavía no has guardado. Si sales ahora, se pierden.
      </p>
      <div className="acciones">
        <button className="boton suave" type="button" onClick={() => bloqueo.proceed?.()}>
          Salir sin guardar
        </button>
        <button className="boton azul" type="button" data-enfoque onClick={() => bloqueo.reset?.()}>
          Seguir editando
        </button>
      </div>
    </Dialogo>
  )
}
