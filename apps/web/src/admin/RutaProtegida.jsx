import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import PanelLayout from '@/admin/PanelLayout.jsx'
import { RUTA_ENTRAR } from '@/admin/ruta.js'
import { sesion } from '@/admin/sesion.js'
import '@/admin/panel.css'

// El portero de la web (ADM-02): todas las pantallas del panel, menos la de entrar, pasan
// por aquí. Pregunta a la API si hay sesión: sí → el panel; no → a entrar, y al entrar se
// vuelve a la pantalla que se quería abrir. La seguridad de verdad está en la API: esto es
// para que veas lo correcto.
export default function RutaProtegida() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const desde = useRef(pathname)
  const [estado, setEstado] = useState({ comprobando: true })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    sesion().then((r) => {
      if (!vivo) return
      if (r.correo) setEstado({ correo: r.correo })
      else if (r.error === 'red') setEstado({ sinConexion: true })
      else navigate(RUTA_ENTRAR, { replace: true, state: { desde: desde.current, caducada: r.error === 'sesion_caducada' } })
    })
    return () => {
      vivo = false
    }
  }, [navigate, intento])

  if (estado.correo) return <PanelLayout correo={estado.correo} />

  return (
    <div className="panel-app panel-solo">
      {estado.sinConexion ? (
        <div className="vacio" role="alert">
          <span className="icono" aria-hidden="true">
            ✕
          </span>
          <h1>No se puede conectar</h1>
          <p>El panel no encuentra la API. Comprueba que está arrancada y vuelve a probar.</p>
          <button
            className="boton azul"
            type="button"
            onClick={() => {
              setEstado({ comprobando: true })
              setIntento((n) => n + 1)
            }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="panel-comprobando" aria-busy="true" aria-label="Comprobando la sesión">
          <span className="hueco grande" />
          <span className="hueco" />
          <span className="hueco corto" />
        </div>
      )}
    </div>
  )
}
