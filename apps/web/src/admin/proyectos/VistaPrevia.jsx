import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { llamar } from '@/admin/api.js'
import { RUTA_ENTRAR } from '@/admin/ruta.js'
import { ContentContext } from '@/content/ContentContext.js'
import { LanguageContext } from '@/i18n/LanguageContext.js'
import Revelado from '@/layout/Revelado.jsx'
import ProjectPage from '@/pages/ProjectPage.jsx'
import '@/admin/proyectos/vista-previa.css'

// La vista previa de un proyecto (ADM-03): la página de la web, la de verdad, con lo
// guardado de este proyecto aunque sea un borrador. Se abre en otra pestaña, sin el panel
// alrededor. La API la protege como todo el panel: sin sesión, a entrar y de vuelta aquí.
export default function VistaPrevia() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [previa, setPrevia] = useState(null) // { slug, contenido }
  const [error, setError] = useState(null)
  const [lang, setLang] = useState('es')

  useEffect(() => {
    let vivo = true
    llamar(`/projects/${id}/vista-previa`).then((r) => {
      if (!vivo) return
      if (r.estado === 401) navigate(RUTA_ENTRAR, { replace: true, state: { desde: pathname } })
      else if (r.estado === 200) setPrevia(r.datos)
      else setError(r.estado === 404 ? 'Este proyecto no existe.' : 'No se ha podido cargar la vista previa.')
    })
    return () => {
      vivo = false
    }
  }, [id, pathname, navigate])

  return (
    <div className="vista-previa">
      <div className="franja-previa" role="region" aria-label="Vista previa">
        <p>
          <b>Vista previa</b> · así se verá en la web al publicar. Enseña lo guardado.
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
      {!previa && !error && <p className="aviso-previa">Cargando…</p>}
      {previa && (
        <ContentContext.Provider value={previa.contenido}>
          <LanguageContext.Provider value={lang}>
            <ProjectPage slug={previa.slug} />
            <Revelado />
          </LanguageContext.Provider>
        </ContentContext.Provider>
      )}
    </div>
  )
}
