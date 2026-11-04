import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { llamar } from '@/panel/utilidades/api.js'
import { RUTA_ENTRAR } from '@/panel/utilidades/ruta.js'
import { TIPOS } from '@/panel/trayectoria/campos.js'
import { ContextoContenido } from '@/contenido/ContextoContenido.js'
import { ContextoIdioma } from '@/idioma/ContextoIdioma.js'
import Revelado from '@/compartido/componentes/Revelado.jsx'
import Trayectoria from '@/web/secciones/Trayectoria.jsx'
import '@/panel/proyectos/vista-previa.css'

// La vista previa de un empleo o una formación (ADM-06): la sección Trayectoria de la web,
// la de verdad, con lo guardado y con esta entrada aunque esté oculta. Como la de
// Proyectos: en su pestaña, sin el panel alrededor; sin sesión, a entrar y de vuelta.
export function VistaPreviaEmpleo() {
  return <VistaPrevia tipo={TIPOS.empleo} />
}

export function VistaPreviaFormacion() {
  return <VistaPrevia tipo={TIPOS.formacion} />
}

function VistaPrevia({ tipo }) {
  const { id } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [contenido, setContenido] = useState(null)
  const [error, setError] = useState(null)
  const [lang, setLang] = useState('es')

  useEffect(() => {
    let vivo = true
    llamar(`${tipo.api}/${id}/vista-previa`).then((r) => {
      if (!vivo) return
      if (r.estado === 401) navigate(RUTA_ENTRAR, { replace: true, state: { desde: pathname } })
      else if (r.estado === 200) setContenido(r.datos.contenido)
      else setError(r.estado === 404 ? 'No existe.' : 'No se ha podido cargar la vista previa.')
    })
    return () => {
      vivo = false
    }
  }, [id, pathname, navigate, tipo])

  return (
    <div className="vista-previa">
      <div className="franja-previa" role="region" aria-label="Vista previa">
        <p>
          <b>Vista previa</b> · la trayectoria como se verá al publicar. Enseña lo guardado, también lo oculto de esta
          {tipo === TIPOS.empleo ? ' entrada' : ' formación'}.
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
      {contenido && (
        <ContextoContenido.Provider value={contenido}>
          <ContextoIdioma.Provider value={lang}>
            <main>
              <Trayectoria />
            </main>
            <Revelado />
          </ContextoIdioma.Provider>
        </ContextoContenido.Provider>
      )}
    </div>
  )
}
