import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { llamar } from '@/panel/utilidades/api.js'
import { RUTA_ENTRAR } from '@/panel/utilidades/ruta.js'
import { ContextoContenido } from '@/contenido/ContextoContenido.js'
import { ContextoIdioma } from '@/idioma/ContextoIdioma.js'
import Revelado from '@/compartido/componentes/Revelado.jsx'
import PaginaProyecto from '@/web/paginas/PaginaProyecto.jsx'
import '@/panel/proyectos/vista-previa.css'

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
        <ContextoContenido.Provider value={previa.contenido}>
          <ContextoIdioma.Provider value={lang}>
            <PaginaProyecto slug={previa.slug} />
            <Revelado />
          </ContextoIdioma.Provider>
        </ContextoContenido.Provider>
      )}
    </div>
  )
}
