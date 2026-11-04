import Marcado from '@/compartido/componentes/Marcado.jsx'
import { mesIso, periodo, porFechaDesc } from '@/contenido/fechas.js'
import { useContenido } from '@/contenido/useContenido.js'
import { useIdioma, useElegir, useT } from '@/idioma/useIdioma.js'
import EnlaceFuera from '@/compartido/componentes/EnlaceFuera.jsx'
import CabeceraSeccion from '@/web/secciones/CabeceraSeccion.jsx'
import '@/web/secciones/trayectoria.css'

// El certificado: primero el enlace de verificación (lo más fiable); si no hay, el
// archivo; sin ninguno, no hay botón.
function Certificado({ curso }) {
  const t = useT()
  const destino = curso.certificate_url || curso.certificate_file
  if (!destino) return null
  return (
    <EnlaceFuera className="btn btn--ghost certificado" href={destino}>
      {t('trayectoria.certificado')}
    </EnlaceFuera>
  )
}

// Una fila de la línea de tiempo: fechas · qué y dónde · descripción (y logros).
// La compacta (cursos) no lleva descripción: fechas · qué y dónde · certificado.
function Fila({ inicio, fin, titulo, donde, parrafos = [], logros = [], pie = null, compacta = false }) {
  const t = useT()
  const lang = useIdioma()
  return (
    <li>
      <article className={compacta ? 'row compacta' : 'row'}>
        <p className="when">
          <time dateTime={mesIso(inicio)}>{periodo(lang, inicio, fin, t('trayectoria.actualidad'))}</time>
        </p>
        <div className="what">
          <h4>{titulo}</h4>
          {donde && <p className="where">{donde}</p>}
        </div>
        {compacta ? (
          pie && <div className="pie-fila">{pie}</div>
        ) : (
          <div className="desc">
            {parrafos.map((parrafo) => (
              <p key={parrafo}>
                <Marcado texto={parrafo} />
              </p>
            ))}
            {logros.length > 0 && (
              <ul>
                {logros.map((logro) => (
                  <li key={logro}>
                    <Marcado texto={logro} />
                  </li>
                ))}
              </ul>
            )}
            {pie && <div className="pie-fila">{pie}</div>}
          </div>
        )}
      </article>
    </li>
  )
}

const unir = (...partes) => partes.filter(Boolean).join(' · ')

function Bloque({ titulo, subtitulo, children }) {
  return (
    <div className="bloque-trayectoria" data-revelar="">
      <h3 className="subcabecera">
        {titulo}
        {subtitulo && <span>{subtitulo}</span>}
      </h3>
      <ol className="filas">{children}</ol>
    </div>
  )
}

// Experiencia, formación y cursos de la base de datos, de lo más reciente a lo más
// antiguo. La API ya da solo lo visible (is_visible). Un bloque vacío no se muestra.
export default function Trayectoria() {
  const t = useT()
  const p = useElegir()
  const { jobs, education } = useContenido()

  const filaDe = (curso, compacta) => (
    <Fila
      key={`${p(curso.title)}-${curso.start_date}`}
      inicio={curso.start_date}
      fin={curso.end_date}
      titulo={p(curso.title)}
      donde={unir(curso.institution, curso.location, curso.hours && `${curso.hours} h`)}
      parrafos={p(curso.description) || []}
      pie={<Certificado curso={curso} />}
      compacta={compacta}
    />
  )
  const ordenada = porFechaDesc(education)
  const formacion = ordenada.filter((c) => c.kind !== 'course')
  const cursos = ordenada.filter((c) => c.kind === 'course')

  return (
    <section id="trayectoria" className="seccion timeline">
      <CabeceraSeccion id="trayectoria" />

      {/* Primero la formación (y los cursos), después la experiencia laboral. */}
      {formacion.length > 0 && (
        <Bloque titulo={t('trayectoria.formacion')}>{formacion.map((curso) => filaDe(curso, false))}</Bloque>
      )}

      {cursos.length > 0 && (
        <Bloque titulo={t('trayectoria.cursos')}>{cursos.map((curso) => filaDe(curso, true))}</Bloque>
      )}

      <Bloque titulo={t('trayectoria.experiencia')} subtitulo={t('trayectoria.experiencia_sub')}>
        {porFechaDesc(jobs).map((empleo) => (
          <Fila
            key={`${empleo.company}-${empleo.start_date}`}
            inicio={empleo.start_date}
            fin={empleo.end_date}
            titulo={p(empleo.position)}
            donde={unir(empleo.company, empleo.location)}
            parrafos={p(empleo.description) || []}
            logros={p(empleo.achievements) || []}
          />
        ))}
      </Bloque>
    </section>
  )
}
