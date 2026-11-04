import { useContribuciones } from '@/contenido/useContribuciones.js'
import { useT } from '@/idioma/useIdioma.js'
import CuadriculaContribuciones from '@/web/secciones/CuadriculaContribuciones.jsx'
import Contador from '@/compartido/componentes/Contador.jsx'
import CabeceraSeccion from '@/web/secciones/CabeceraSeccion.jsx'
import '@/web/secciones/actividad.css'

// Las cifras llegan ya calculadas de la API (o de la copia incrustada en el build).
export default function Actividad() {
  const t = useT()
  const datos = useContribuciones()

  const cifras = [
    { clave: 'actividad.contribuciones', valor: datos.total },
    { clave: 'actividad.racha_actual', valor: datos.racha_actual, enDias: true },
    { clave: 'actividad.racha_maxima', valor: datos.racha_maxima, enDias: true },
    { clave: 'actividad.media_semanal', valor: datos.media_semanal },
  ]

  return (
    <section id="actividad" className="seccion activity">
      <CabeceraSeccion id="actividad" />

      <dl className="gh-stats" data-revelar="">
        {cifras.map(({ clave, valor, enDias }) => (
          <div key={clave} className="gh-stat">
            <dt>{t(clave)}</dt>
            <dd>
              <Contador valor={valor} />
              {enDias && <span className="u">{t(valor === 1 ? 'actividad.dia' : 'actividad.dias')}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <CuadriculaContribuciones semanas={datos.semanas} total={datos.total} />
    </section>
  )
}
