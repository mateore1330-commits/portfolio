import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import contenido from '@/content/snapshot.json'
import { ponerTitulo } from '@/i18n/documento.js'
import FondoEntrar from '@/admin/FondoEntrar.jsx'
import { RUTA_PANEL } from '@/admin/ruta.js'
import { ERRORES_ENTRAR as ERRORES, entrar, hayApi, sesion } from '@/admin/sesion.js'
import '@/admin/entrar.css'

// La pantalla de entrar al panel (ADM-01), como en la maqueta aprobada (ADM-00): siempre
// oscura, sin textos que den pistas y con un enlace discreto a la web. Si la sesión había
// caducado, se dice y, al entrar, se vuelve a la pantalla en la que estabas.
export default function Entrar() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const destino = state?.desde || RUTA_PANEL
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [ver, setVer] = useState(false)
  const [comprobando, setComprobando] = useState(false)
  const [error, setError] = useState('')
  const campoContrasena = useRef(null)
  const nombre = contenido.site_texts['hero.nombre'].es

  // Si ya hay sesión, directo al panel.
  useEffect(() => {
    ponerTitulo('Entrar')
    let vivo = true
    sesion().then((r) => {
      if (vivo && r.correo) navigate(destino, { replace: true })
    })
    return () => {
      vivo = false
    }
  }, [navigate, destino])

  const enviar = async (e) => {
    e.preventDefault()
    if (comprobando) return
    setComprobando(true)
    setError('')
    const r = await entrar(correo, contrasena)
    if (r.ok) {
      navigate(destino, { replace: true })
      return
    }
    // El correo escrito se queda; la contraseña se borra para escribirla de nuevo.
    setError(r.error)
    setContrasena('')
    setComprobando(false)
    campoContrasena.current?.focus()
  }

  const bloqueado = error === 'demasiados_intentos'

  return (
    <div className="pantalla-entrar">
      <FondoEntrar nombre={nombre} />
      <a className="entrar-volver" href="/" data-cursor="Web">
        ← mateorodriguez.solutions
      </a>
      <main className="entrar-centro">
        <div className="entrar-caja">
          <p className="entrar-marca">
            {nombre}
            <small>Panel</small>
          </p>
          <h1>Entrar</h1>

          {state?.caducada && !error && <p className="entrar-aviso info">Tu sesión caducó. Entra de nuevo y volverás donde estabas.</p>}
          {!hayApi && <p className="entrar-aviso error">El panel necesita la API (VITE_API_URL).</p>}
          <p className="entrar-aviso error" role="alert" hidden={!error}>
            {ERRORES[error]}
          </p>

          <form onSubmit={enviar} noValidate>
            <div className="entrar-campo">
              <label htmlFor="entrar-correo">Correo</label>
              <input id="entrar-correo" type="email" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
            </div>
            <div className="entrar-campo">
              <label htmlFor="entrar-contrasena">Contraseña</label>
              <div className="con-boton">
                <input
                  ref={campoContrasena}
                  id="entrar-contrasena"
                  type={ver ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                />
                <button type="button" data-cursor="Ver" aria-pressed={ver} onClick={() => setVer((v) => !v)}>
                  {ver ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <button className="entrar-boton" type="submit" data-iman data-cursor="Entrar" disabled={comprobando || bloqueado || !hayApi}>
              <span>{comprobando ? 'Comprobando…' : bloqueado ? 'Espera unos minutos' : 'Entrar'}</span>
              <span aria-hidden="true">{comprobando ? '◌' : '→'}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
