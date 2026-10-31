import { useContent } from '@/content/useContent.js'
import { usePick } from '@/i18n/useLang.js'
import SectionHead from '@/sections/SectionHead.jsx'
import SkillBar from '@/sections/SkillBar.jsx'
import '@/sections/skills.css'

// Los grupos salen de las tecnologías (is_skill), que la API ya manda ordenadas por
// grupo y por sort_order: el orden de los grupos es el de su primera tecnología.
// Títulos y subtítulos, de conocimientos.grupos. Nada escrito en el componente.
export default function Skills() {
  const p = usePick()
  const { site_texts: textos, technologies } = useContent()
  const titulos = p(textos['conocimientos.grupos'])

  const grupos = new Map()
  for (const tec of technologies.filter((t) => t.is_skill)) {
    if (!grupos.has(tec.category)) grupos.set(tec.category, [])
    grupos.get(tec.category).push(tec)
  }

  return (
    <section id="conocimientos" className="seccion skills">
      <SectionHead id="conocimientos" />

      <div className="skgrid">
        {[...grupos].map(([categoria, lista]) => (
          <div key={categoria} className="skcol" data-revelar="">
            <h3>{titulos[categoria]?.titulo ?? categoria}</h3>
            <p className="sub">{titulos[categoria]?.subtitulo}</p>
            <ul>
              {lista.map((tec) => (
                <li key={tec.name} className="sk">
                  <div className="sk-top">
                    <span className="sk-name">{p(tec.display_name) || tec.name}</span>
                    {tec.level_label && <span className="sk-lvl">{p(tec.level_label)}</span>}
                  </div>
                  {/* Sin nivel (Transversal), sin barra: esas se demuestran con la trayectoria. */}
                  {tec.level != null && <SkillBar nivel={tec.level} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
