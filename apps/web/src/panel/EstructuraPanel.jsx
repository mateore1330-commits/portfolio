import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import retrato from '@/recursos/retrato/retrato-400.jpg'
import contenido from '@/contenido/instantanea.json'
import { pedir } from '@/panel/utilidades/api.js'
import Avisos from '@/panel/comun/Avisos.jsx'
import DialogoSesion from '@/panel/comun/DialogoSesion.jsx'
import BarraPublicar from '@/panel/publicar/BarraPublicar.jsx'
import DialogoPublicar from '@/panel/publicar/DialogoPublicar.jsx'
import { RUTA_ENTRAR, RUTA_PANEL } from '@/panel/utilidades/ruta.js'
import { GRUPOS, SECCIONES } from '@/panel/utilidades/menu.js'
import { salir } from '@/panel/utilidades/sesion.js'
import { useTema } from '@/tema/useTema.js'
import '@/panel/panel.css'

const consultaOscuro = '(prefers-color-scheme: dark)'
const suscribirOscuro = (aviso) => {
  const media = matchMedia(consultaOscuro)
  media.addEventListener('change', aviso)
  return () => media.removeEventListener('change', aviso)
}

const rutaDe = (seccion) => (seccion.ruta ? `${RUTA_PANEL}/${seccion.ruta}` : RUTA_PANEL)
const nombre = contenido.site_texts['hero.nombre'].es

// El armazón de todas las pantallas del panel (ADM-02), como en la maqueta (ADM-00): el
// menú lateral (en el móvil, detrás del botón Menú) y la barra de arriba, con Publicar
// (ADM-05). Pide el resumen (contador de mensajes, Inicio) y qué hay sin publicar; las
// pantallas los vuelven a pedir con cargarResumen() al guardar.
export default function EstructuraPanel({ correo }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [resumen, setResumen] = useState(null)
  const [saliendo, setSaliendo] = useState(false)
  const [publicar, setPublicar] = useState(null) // { pendientes, ultima }
  const [publicando, setPublicando] = useState(false)

  const cargarPublicar = useCallback(async () => {
    const r = await pedir('/publicar')
    setPublicar(r.ok ? r.datos : { error: r.error })
  }, [])

  const cargarResumen = useCallback(async () => {
    setResumen(null)
    cargarPublicar()
    const r = await pedir('/resumen')
    setResumen(r.ok ? r.datos : { error: r.error })
  }, [cargarPublicar])

  useEffect(() => {
    let vivo = true
    pedir('/resumen').then((r) => vivo && setResumen(r.ok ? r.datos : { error: r.error }))
    pedir('/publicar').then((r) => vivo && setPublicar(r.ok ? r.datos : { error: r.error }))
    return () => {
      vivo = false
    }
  }, [])

  const abrirPublicar = useCallback(() => setPublicando(true), [])

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

  // Los avisos van dentro de .panel-app: sus estilos solo valen ahí.
  return (
    <div className={`panel-app${menuAbierto ? ' menu-abierto' : ''}`}>
      <Avisos>
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
            <BarraPublicar estado={publicar} alPublicar={abrirPublicar} />
          </header>
          <main className="cont" id="contenido" tabIndex={-1}>
            <Outlet context={{ resumen, cargarResumen, publicar, abrirPublicar }} />
          </main>
        </div>
        <DialogoPublicar
          abierto={publicando}
          pendientes={publicar?.pendientes ?? []}
          alCerrar={() => setPublicando(false)}
          alPublicado={cargarResumen}
        />
        <DialogoSesion correoInicial={correo} />
      </Avisos>
    </div>
  )
}

// Claro ↔ oscuro, partiendo del que se ve ahora. La misma preferencia que la web.
function BotonModo() {
  const { theme, setTheme } = useTema()
  const sistemaOscuro = useSyncExternalStore(suscribirOscuro, () => matchMedia(consultaOscuro).matches)
  const visible = theme === 'system' ? (sistemaOscuro ? 'dark' : 'light') : theme
  const siguiente = visible === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" onClick={() => setTheme(siguiente)} aria-label={siguiente === 'dark' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
      Modo
    </button>
  )
}
