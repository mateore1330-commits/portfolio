import { useContribuciones } from '@/content/useContribuciones.js'
import { useT } from '@/i18n/useLang.js'
import ContributionGrid from '@/sections/ContributionGrid.jsx'
import Counter from '@/sections/Counter.jsx'
import SectionHead from '@/sections/SectionHead.jsx'
import '@/sections/activity.css'

// Las cifras llegan ya calculadas de la API (o de la copia incrustada en el build).
export default function Activity() {
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
      <SectionHead id="actividad" />

      <dl className="gh-stats" data-revelar="">
        {cifras.map(({ clave, valor, enDias }) => (
          <div key={clave} className="gh-stat">
            <dt>{t(clave)}</dt>
            <dd>
              <Counter valor={valor} />
              {enDias && <span className="u">{t(valor === 1 ? 'actividad.dia' : 'actividad.dias')}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <ContributionGrid semanas={datos.semanas} total={datos.total} />
    </section>
  )
}
