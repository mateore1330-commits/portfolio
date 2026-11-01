import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import retrato from '@/assets/retrato/retrato-400.jpg'
import contenido from '@/content/snapshot.json'
import { pedir } from '@/admin/api.js'
import Avisos from '@/admin/comun/Avisos.jsx'
import DialogoSesion from '@/admin/comun/DialogoSesion.jsx'
import { RUTA_ENTRAR, RUTA_PANEL } from '@/admin/ruta.js'
import { GRUPOS, SECCIONES } from '@/admin/secciones.js'
import { salir } from '@/admin/sesion.js'
import { useTheme } from '@/theme/useTheme.js'
import '@/admin/panel.css'

const consultaOscuro = '(prefers-color-scheme: dark)'
const suscribirOscuro = (aviso) => {
  const media = matchMedia(consultaOscuro)
  media.addEventListener('change', aviso)
  return () => media.removeEventListener('change', aviso)
}

const rutaDe = (seccion) => (seccion.ruta ? `${RUTA_PANEL}/${seccion.ruta}` : RUTA_PANEL)
const nombre = contenido.site_texts['hero.nombre'].es

// El armazón de todas las pantallas del panel (ADM-02), como en la maqueta (ADM-00): el
// menú lateral (en el móvil, detrás del botón Menú) y la barra de arriba. Pide el resumen
// una vez: lo usan el contador de mensajes del menú y el Inicio.
export default function PanelLayout({ correo }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [resumen, setResumen] = useState(null)
  const [saliendo, setSaliendo] = useState(false)

  const cargarResumen = useCallback(async () => {
    setResumen(null)
    const r = await pedir('/resumen')
    setResumen(r.ok ? r.datos : { error: r.error })
  }, [])

  useEffect(() => {
    let vivo = true
    pedir('/resumen').then((r) => vivo && setResumen(r.ok ? r.datos : { error: r.error }))
    return () => {
      vivo = false
    }
  }, [])

  // Esc cierra el menú del móvil.
  useEffect(() => {
    if (!menuAbierto) return
    const alPulsar = (e) => e.key === 'Escape' && setMenuAbierto(false)
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [menuAbierto])

  const actual = SECCIONES.find((s) => s.ruta && pathname.startsWith(rutaDe(s))) ?? (pathname === RUTA_PANEL ? SECCIONES[0] : null)
  const contadores = { mensajes: resumen?.mensajes?.sin_leer }

  const alSalir = async () => {
    setSaliendo(true)
    await salir()
    navigate(RUTA_ENTRAR, { replace: true })
  }

  return (
    <Avisos>
      <div className={`panel-app${menuAbierto ? ' menu-abierto' : ''}`}>
        <a className="solo-lector" href="#contenido">
          Saltar al contenido
        </a>
        <aside className="side" id="menu-panel" aria-label="Menú del panel">
          <NavLink className="marca" to={RUTA_PANEL} onClick={() => setMenuAbierto(false)}>
            {nombre}
            <small>Panel</small>
          </NavLink>
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="grupo">{grupo.titulo}</p>
              <nav className="secciones" aria-label={grupo.titulo}>
                {grupo.secciones.map((s) => (
                  <NavLink key={s.nombre} to={rutaDe(s)} end={!s.ruta} onClick={() => setMenuAbierto(false)}>
                    <span className="n">{s.n}</span>
                    {s.nombre}
                    {contadores[s.contador] > 0 && (
                      <span className="c" aria-label={`${contadores[s.contador]} sin leer`}>
                        {contadores[s.contador]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
          <div className="pie-side">
            <div className="yo">
              <img src={retrato} alt="" width="30" height="30" />
              <div>
                <b>{nombre.split(' ')[0]}</b>
                <span>{correo}</span>
              </div>
            </div>
            <div className="acc">
              <a href="/" target="_blank" rel="noopener" title="Abre la web en otra pestaña">
                Web ↗
              </a>
              <BotonModo />
              <button type="button" onClick={alSalir} disabled={saliendo}>
                {saliendo ? 'Saliendo…' : 'Salir'}
              </button>
            </div>
          </div>
        </aside>
        {menuAbierto && <div className="velo-menu" aria-hidden="true" onClick={() => setMenuAbierto(false)} />}

        <div className="main">
          <header className="barra-arriba">
            <button
              className="boton suave pequeno abrir-menu"
              type="button"
              aria-expanded={menuAbierto}
              aria-controls="menu-panel"
              onClick={() => setMenuAbierto((v) => !v)}
            >
              Menú
            </button>
            <p className="miga">
              <b>{actual?.nombre ?? 'No encontrado'}</b>
            </p>
          </header>
          <main className="cont" id="contenido" tabIndex={-1}>
            <Outlet context={{ resumen, cargarResumen }} />
          </main>
        </div>
        <DialogoSesion correoInicial={correo} />
      </div>
    </Avisos>
  )
}

// Claro ↔ oscuro, partiendo del que se ve ahora. La misma preferencia que la web.
function BotonModo() {
  const { theme, setTheme } = useTheme()
  const sistemaOscuro = useSyncExternalStore(suscribirOscuro, () => matchMedia(consultaOscuro).matches)
  const visible = theme === 'system' ? (sistemaOscuro ? 'dark' : 'light') : theme
  const siguiente = visible === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" onClick={() => setTheme(siguiente)} aria-label={siguiente === 'dark' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
      Modo
    </button>
  )
}
