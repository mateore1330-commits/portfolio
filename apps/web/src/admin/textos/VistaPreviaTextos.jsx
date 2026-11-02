import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { llamar } from '@/admin/api.js'
import { RUTA_ENTRAR } from '@/admin/ruta.js'
import { MENSAJE_LISTA, MENSAJE_TEXTOS } from '@/admin/textos/textos.js'
import { ContentContext } from '@/content/ContentContext.js'
import ContribucionesProvider from '@/content/ContribucionesProvider.jsx'
import { LanguageContext } from '@/i18n/LanguageContext.js'
import Footer from '@/layout/Footer.jsx'
import Revelado from '@/layout/Revelado.jsx'
import LegalPage from '@/pages/LegalPage.jsx'
import About from '@/sections/About.jsx'
import Contact from '@/sections/Contact.jsx'
import Hero from '@/sections/Hero.jsx'
import Skills from '@/sections/Skills.jsx'
import '@/admin/proyectos/vista-previa.css'
import '@/layout/layout.css'

// Cada sección de la pantalla Textos, con la pieza de la web que la pinta (la de verdad).
const PIEZAS = {
  portada: () => <Hero />,
  sobre: () => <About />,
  conocimientos: () => <Skills />,
  contacto: () => <Contact />,
  pie: () => <Footer />,
  aviso: () => <LegalPage clave="aviso" />,
  privacidad: () => <LegalPage clave="privacidad" />,
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
        <ContentContext.Provider value={contenido}>
          <ContribucionesProvider>
            <LanguageContext.Provider value={lang}>
              {seccion === 'pie' || seccion === 'aviso' || seccion === 'privacidad' ? (
                <Pieza />
              ) : (
                <main>
                  <Pieza />
                </main>
              )}
              <Revelado />
            </LanguageContext.Provider>
          </ContribucionesProvider>
        </ContentContext.Provider>
      )}
    </div>
  )
}
