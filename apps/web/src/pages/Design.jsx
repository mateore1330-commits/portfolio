import { useEffect, useState } from 'react'
import { useTheme } from '@/theme/useTheme.js'
import '@/pages/design.css'

// Página interna para revisar el sistema de diseño. Solo existe en desarrollo.

const PALETTE = [
  ['Superficie', ['--paper', '--paper-2', '--paper-3']],
  ['Tinta', ['--ink', '--ink-2', '--ink-3', '--mist']],
  ['Líneas', ['--rule', '--rule-2']],
  ['Acento', ['--blue', '--blue-2', '--blue-wash', '--on-blue']],
  ['Panel de contacto · igual en los dos temas', ['--panel', '--panel-2', '--panel-ink', '--panel-dim', '--panel-blue']],
  ['Gráfico de contribuciones', ['--lv0', '--lv1', '--lv2', '--lv3', '--lv4']],
]

const TYPE = [
  ['--fs-d-hero', 'display', 'Mateo'],
  ['--fs-d-xl', 'display', 'Hablemos'],
  ['--fs-d-l', 'display', 'CleanFlow'],
  ['--fs-num', 'display', '441'],
  ['--fs-d-m', 'display', 'Desarrollador full stack'],
  ['--fs-d-s', 'display', 'Frontend'],
  ['--fs-big', 'body', 'Traigo la parte técnica nueva y la profesional ya rodada.'],
  ['--fs-lede', 'body', 'Desarrollador full stack recién salido del bootcamp.'],
  ['--fs-body', 'body', 'El texto de párrafo de toda la web, en Newsreader.'],
  ['--fs-body-s', 'body', 'Descripciones de proyecto y de trayectoria.'],
  ['--fs-mono-l', 'mono', 'react · python · sqlalchemy'],
  ['--fs-mono-m', 'mono', '01 · Sobre mí'],
  ['--fs-mono-s', 'mono', 'Ver el repositorio'],
  ['--fs-mono-xs', 'mono', 'Contribuciones · 2026'],
]

const SPACING = ['--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-7', '--sp-8', '--sp-9', '--sp-10']

const THEMES = [
  ['system', 'Sistema'],
  ['light', 'Claro'],
  ['dark', 'Oscuro'],
]

// Lee los valores en vivo del CSS: si cambia un token, la muestra no miente.
function readTokens() {
  const styles = getComputedStyle(document.documentElement)
  const names = [...PALETTE.flatMap(([, list]) => list), ...TYPE.map(([name]) => name), ...SPACING]
  return Object.fromEntries(names.map((name) => [name, styles.getPropertyValue(name).trim()]))
}

export default function Design() {
  const { theme, setTheme } = useTheme()
  const [values, setValues] = useState({})

  useEffect(() => {
    // Se espera un fotograma para leer después de que el tema se aplique.
    const refresh = () => requestAnimationFrame(() => setValues(readTokens()))
    refresh()
    const media = matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', refresh)
    return () => media.removeEventListener('change', refresh)
  }, [theme])

  return (
    <main className="ds">
      <header className="ds-head">
        <span className="mono ds-dim">/_design · solo en desarrollo</span>
        <h1>Plano y plata</h1>
        <div className="ds-themes" role="group" aria-label="Tema">
          {THEMES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={id === theme ? 'btn' : 'btn btn--ghost'}
              aria-pressed={id === theme}
              onClick={() => setTheme(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <Section n="01" title="Paleta">
        {PALETTE.map(([group, list]) => (
          <div key={group} className="ds-group">
            <h3 className="mono ds-dim">{group}</h3>
            <div className="ds-swatches">
              {list.map((name) => (
                <figure key={name} className="ds-swatch">
                  <span style={{ background: `var(${name})` }} />
                  <figcaption>
                    <b>{name}</b>
                    <code>{values[name]}</code>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section n="02" title="Escala tipográfica">
        {TYPE.map(([name, family, sample]) => (
          <div key={name} className="ds-type">
            <div className="mono ds-dim">
              <b>{name}</b> · {family} · {values[name]}
            </div>
            <p className={`ds-type-${family}`} style={{ fontSize: `var(${name})` }}>
              {sample}
            </p>
          </div>
        ))}
      </Section>

      <Section n="03" title="Espaciados">
        {SPACING.map((name) => (
          <div key={name} className="ds-space">
            <span className="mono ds-dim">
              {name} · {values[name]}
            </span>
            <i style={{ width: `var(${name})` }} />
          </div>
        ))}
      </Section>

      <Section n="04" title="Componentes base">
        <div className="ds-components">
          <h1>Encabezado 1</h1>
          <h2>Encabezado 2</h2>
          <h3>Encabezado 3</h3>
          <h4>Encabezado 4</h4>
          <p>
            Párrafo en Newsreader con <em>una cursiva</em> y <a href="#">un enlace</a>.
            Selecciona este texto para ver el color de selección.
          </p>
          <span className="mono">Etiqueta mono · 01</span>
          <div className="ds-row">
            <a className="btn" href="#">Botón</a>
            <a className="btn btn--ghost" href="#">Botón fantasma</a>
          </div>
          <label className="ds-field">
            <span className="mono ds-dim">Pulsa Tab hasta aquí para ver el foco</span>
            <input type="text" placeholder="Campo de texto" />
          </label>
        </div>
      </Section>
    </main>
  )
}

function Section({ n, title, children }) {
  return (
    <section className="ds-section">
      <div className="ds-sechead mono">
        <span className="ds-n">{n}</span>
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}
