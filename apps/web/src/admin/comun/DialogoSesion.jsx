import { useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { motivoSesion, suscribirSesion, terminarEspera } from '@/admin/api.js'
import Dialogo from '@/admin/comun/Dialogo.jsx'
import { RUTA_ENTRAR } from '@/admin/ruta.js'
import { ERRORES_ENTRAR, entrar } from '@/admin/sesion.js'

const TEXTOS = {
  sesion_caducada: ['Tu sesión ha caducado', 'Por seguridad, las sesiones duran 8 horas.'],
  sin_sesion: ['Tu sesión se ha cerrado', 'Se ha cerrado desde otro dispositivo o ha cambiado la contraseña.'],
}

// Se abre encima de la pantalla cuando la API responde 401 a mitad de trabajo (ver
// pedir() en api.js). La pantalla de debajo no se toca: al volver a entrar, lo que falló
// se repite solo y sigues donde estabas.
export default function DialogoSesion({ correoInicial }) {
  const motivo = useSyncExternalStore(suscribirSesion, motivoSesion)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [correo, setCorreo] = useState(correoInicial)
  const [contrasena, setContrasena] = useState('')
  const [comprobando, setComprobando] = useState(false)
  const [error, setError] = useState('')
  const [titulo, motivoTexto] = TEXTOS[motivo] ?? TEXTOS.sin_sesion

  const enviar = async (e) => {
    e.preventDefault()
    if (comprobando) return
    setComprobando(true)
    setError('')
    const r = await entrar(correo, contrasena)
    setContrasena('')
    setComprobando(false)
    if (r.ok) terminarEspera(true)
    else setError(r.error)
  }

  const alSalir = () => {
    terminarEspera(false)
    navigate(RUTA_ENTRAR, { replace: true, state: { desde: pathname } })
  }

  return (
    <Dialogo abierto={Boolean(motivo)} titulo={titulo} cerrable={false}>
      <p>
        {motivoTexto} <b>Lo que has escrito sigue aquí</b>: vuelve a entrar y seguirás en esta misma pantalla.
      </p>
      <form className="campos" onSubmit={enviar} noValidate>
        {error && (
          <p className="err" role="alert">
            {ERRORES_ENTRAR[error] ?? ERRORES_ENTRAR.red}
          </p>
        )}
        <div className="campo-panel">
          <label htmlFor="sesion-correo">Correo</label>
          <input id="sesion-correo" type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div className="campo-panel">
          <label htmlFor="sesion-contrasena">Contraseña</label>
          <input
            id="sesion-contrasena"
            type="password"
            autoComplete="current-password"
            data-enfoque
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </div>
        <div className="acciones">
          <button className="boton suave" type="button" onClick={alSalir}>
            Salir
          </button>
          <button className="boton azul" type="submit" disabled={comprobando || error === 'demasiados_intentos'}>
            {comprobando ? 'Comprobando…' : 'Entrar y seguir →'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
