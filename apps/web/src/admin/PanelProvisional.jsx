import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ponerTitulo } from '@/i18n/documento.js'
import { RUTA_ENTRAR } from '@/admin/ruta.js'
import { salir, sesion } from '@/admin/sesion.js'
import '@/admin/panel.css'

// La entrada al panel mientras no existe el panel de verdad (llega en ADM-02): comprueba la
// sesión y, si no la hay, manda a entrar (diciendo si había caducado). Con sesión, dice con
// qué cuenta has entrado y deja salir.
export default function PanelProvisional() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [correo, setCorreo] = useState('')
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    ponerTitulo('Panel')
    let vivo = true
    sesion().then((r) => {
      if (!vivo) return
      if (r.correo) setCorreo(r.correo)
      else navigate(RUTA_ENTRAR, { replace: true, state: { desde: pathname, caducada: r.error === 'sesion_caducada' } })
    })
    return () => {
      vivo = false
    }
  }, [navigate, pathname])

  const alSalir = async () => {
    setSaliendo(true)
    await salir()
    navigate(RUTA_ENTRAR, { replace: true })
  }

  if (!correo) return <main className="panel-provisional" aria-busy="true" />

  return (
    <main className="panel-provisional">
      <p className="mono">Panel · provisional</p>
      <h1>Has entrado</h1>
      <p>
        Sesión abierta como <b>{correo}</b>. El panel completo (menú, proyectos, textos…) llega en ADM-02.
      </p>
      <button className="btn" type="button" onClick={alSalir} disabled={saliendo}>
        {saliendo ? 'Saliendo…' : 'Salir'}
      </button>
    </main>
  )
}
