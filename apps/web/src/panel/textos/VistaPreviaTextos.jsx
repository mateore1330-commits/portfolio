import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { llamar } from '@/panel/utilidades/api.js'
import { RUTA_ENTRAR } from '@/panel/utilidades/ruta.js'
import { MENSAJE_LISTA, MENSAJE_TEXTOS } from '@/panel/textos/textos.js'
import { ContextoContenido } from '@/contenido/ContextoContenido.js'
import ProveedorContribuciones from '@/contenido/ProveedorContribuciones.jsx'
import { ContextoIdioma } from '@/idioma/ContextoIdioma.js'
import Pie from '@/web/estructura/Pie.jsx'
import Revelado from '@/compartido/componentes/Revelado.jsx'
import PaginaLegal from '@/web/paginas/PaginaLegal.jsx'
import SobreMi from '@/web/secciones/SobreMi.jsx'
import Contacto from '@/web/secciones/Contacto.jsx'
import Inicio from '@/web/secciones/Inicio.jsx'
import Conocimientos from '@/web/secciones/Conocimientos.jsx'
import '@/panel/proyectos/vista-previa.css'
import '@/web/estructura/estructura.css'

// Cada sección de la pantalla Textos, con la pieza de la web que la pinta (la de verdad).
const PIEZAS = {
  portada: () => <Inicio />,
  sobre: () => <SobreMi />,
  conocimientos: () => <Conocimientos />,
  contacto: () => <Contacto />,
  pie: () => <Pie />,
  aviso: () => <PaginaLegal clave="aviso" />,
  privacidad: () => <PaginaLegal clave="privacidad" />,
}

// La vista previa de los textos (ADM-04, decidido: la web real). Pinta la sección de la web
// con lo guardado y, encima, lo que hay escrito en la pestaña de Textos aunque no se haya
// guardado: esa pestaña se lo manda por el navegador en cada cambio (postMessage), sin
// pasar por la API. Si se abre sola, enseña lo guardado.
export default function VistaPreviaTextos() {
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [guardado, setGuardado] = useState(null)
  const [borrador, setBorrador] = useState(null) // { textos, seccion } de la pestaña de Textos
  const [error, setError] = useState(null)
  const [lang, setLang] = useState('es')

  useEffect(() => {
    let vivo = true
    llamar('/vista-previa').then((r) => {
      if (!vivo) return
      if (r.estado === 401) navigate(RUTA_ENTRAR, { replace: true, state: { desde: pathname + search } })
      else if (r.estado === 200) setGuardado(r.datos)
      else setError('No se ha podido cargar la vista previa.')
    })
    return () => {
      vivo = false
    }
  }, [pathname, search, navigate])

  useEffect(() => {
    const alMensaje = (e) => {
      if (e.origin !== window.location.origin || e.source !== window.opener) return
      if (e.data?.tipo === MENSAJE_TEXTOS) setBorrador({ textos: e.data.textos, seccion: e.data.seccion })
    }
    window.addEventListener('message', alMensaje)
    window.opener?.postMessage({ tipo: MENSAJE_LISTA }, window.location.origin)
    return () => window.removeEventListener('message', alMensaje)
  }, [])

  const seccion = borrador?.seccion ?? params.get('seccion') ?? 'portada'
  const Pieza = PIEZAS[seccion]
  const contenido = guardado && {
    ...guardado,
    site_texts: { ...guardado.site_texts, ...borrador?.textos },
  }

  return (
    <div className="vista-previa">
      <div className="franja-previa" role="region" aria-label="Vista previa">
        <p>
          <b>Vista previa</b> ·{' '}
          {borrador ? 'lo que tienes escrito, aunque no esté guardado.' : 'lo guardado (abre la vista previa desde Textos para ver lo que escribes).'}
        </p>
        <div className="idiomas" role="group" aria-label="Idioma">
          {['es', 'en'].map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="aviso-previa">{error}</p>}
      {!contenido && !error && <p className="aviso-previa">Cargando…</p>}
      {contenido && !Pieza && <p className="aviso-previa">Esta sección no tiene vista previa.</p>}
      {contenido && Pieza && (
        <ContextoContenido.Provider value={contenido}>
          <ProveedorContribuciones>
            <ContextoIdioma.Provider value={lang}>
              {seccion === 'pie' || seccion === 'aviso' || seccion === 'privacidad' ? (
                <Pieza />
              ) : (
                <main>
                  <Pieza />
                </main>
              )}
              <Revelado />
            </ContextoIdioma.Provider>
          </ProveedorContribuciones>
        </ContextoContenido.Provider>
      )}
    </div>
  )
}
