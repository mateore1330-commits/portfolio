import { useContent } from '@/content/useContent.js'
import { useContribuciones } from '@/content/useContribuciones.js'
import { usePick } from '@/i18n/useLang.js'
import Counter from '@/sections/Counter.jsx'
import SectionHead from '@/sections/SectionHead.jsx'
import '@/sections/about.css'

export default function About() {
  const p = usePick()
  const { site_texts: textos } = useContent()
  const contribuciones = useContribuciones()

  // Una cifra con origen "github" no tiene valor en el contenido: lo pone el gráfico de
  // contribuciones. Si todavía no hay dato, esa cifra no se muestra.
  const cifras = p(textos['sobre.cifras'])
    .map((cifra) => (cifra.origen === 'github' ? { ...cifra, valor: contribuciones?.total } : cifra))
    .filter((cifra) => cifra.valor != null)

  return (
    <section id="sobre-mi" className="seccion about">
      <SectionHead id="sobre-mi" />

      <div className="about-grid">
        <div className="about-texto">
          <p className="bigtext">{p(textos['sobre.titular'])}</p>
          {p(textos['sobre.cuerpo']).map((parrafo) => (
            <p key={parrafo}>{parrafo}</p>
          ))}
          <blockquote className="quote">
            <p>{p(textos['sobre.cita'])}</p>
          </blockquote>
        </div>

        <dl className="facts">
          {cifras.map(({ etiqueta, valor }) => (
            <div key={etiqueta} className="fact">
              <dt>{etiqueta}</dt>
              <dd>
                <Counter valor={valor} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
