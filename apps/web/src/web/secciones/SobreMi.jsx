import { useContenido } from '@/contenido/useContenido.js'
import { useContribuciones } from '@/contenido/useContribuciones.js'
import Marcado from '@/compartido/componentes/Marcado.jsx'
import { useElegir } from '@/idioma/useIdioma.js'
import Contador from '@/compartido/componentes/Contador.jsx'
import CabeceraSeccion from '@/web/secciones/CabeceraSeccion.jsx'
import '@/web/secciones/sobre-mi.css'

export default function SobreMi() {
  const p = useElegir()
  const { site_texts: textos } = useContenido()
  const contribuciones = useContribuciones()

  // Una cifra con origen "github" no tiene valor en el contenido: lo pone el gráfico de
  // contribuciones. Si todavía no hay dato, esa cifra no se muestra.
  const cifras = p(textos['sobre.cifras'])
    .map((cifra) => (cifra.origen === 'github' ? { ...cifra, valor: contribuciones?.total } : cifra))
    .filter((cifra) => cifra.valor != null)

  return (
    <section id="sobre-mi" className="seccion about">
      <CabeceraSeccion id="sobre-mi" />

      <div className="about-grid">
        <div className="about-texto" data-revelar="">
          <p className="bigtext">
            <Marcado texto={p(textos['sobre.titular'])} />
          </p>
          {p(textos['sobre.cuerpo']).map((parrafo) => (
            <p key={parrafo}>{parrafo}</p>
          ))}
          <blockquote className="quote">
            <p>{p(textos['sobre.cita'])}</p>
          </blockquote>
        </div>

        <dl className="facts" data-revelar="">
          {cifras.map(({ etiqueta, valor }) => (
            <div key={etiqueta} className="fact">
              <dt>{etiqueta}</dt>
              <dd>
                <Contador valor={valor} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
