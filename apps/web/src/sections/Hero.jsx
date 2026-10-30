import { useEffect, useRef } from 'react'
import avif400 from '@/assets/retrato/retrato-400.avif'
import jpg400 from '@/assets/retrato/retrato-400.jpg'
import webp400 from '@/assets/retrato/retrato-400.webp'
import avif660 from '@/assets/retrato/retrato-660.avif'
import jpg660 from '@/assets/retrato/retrato-660.jpg'
import webp660 from '@/assets/retrato/retrato-660.webp'
import { useContent } from '@/content/useContent.js'
import { useLang, usePick, useT } from '@/i18n/useLang.js'
import Marquee from '@/sections/Marquee.jsx'
import '@/sections/hero.css'

// Las versiones las genera scripts/optimizar-retrato.py. El navegador elige el primer
// formato que entiende y, dentro de él, el tamaño que le basta.
const srcset = (a, b) => `${a} 400w, ${b} 660w`
const SIZES = '(max-width: 980px) min(78vw, 420px), 38vw'
const INCLINACION = 6 // grados, como en la maqueta

// Inclina el retrato siguiendo el ratón. Solo con ratón y si no se ha pedido menos
// movimiento: en una pantalla táctil no hay "pasar por encima".
function useInclinacion(ref) {
  useEffect(() => {
    const el = ref.current
    const conRaton = window.matchMedia('(hover: hover)').matches
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!el || !conRaton || reducido) return undefined

    const mover = (e) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `translateY(-6px) perspective(900px) rotateY(${x * INCLINACION}deg) rotateX(${-y * INCLINACION}deg)`
    }
    const soltar = () => {
      el.style.transform = ''
    }
    el.addEventListener('mousemove', mover)
    el.addEventListener('mouseleave', soltar)
    return () => {
      el.removeEventListener('mousemove', mover)
      el.removeEventListener('mouseleave', soltar)
    }
  }, [ref])
}

export default function Hero() {
  const t = useT()
  const p = usePick()
  const lang = useLang()
  const { site_texts: textos } = useContent()
  const retrato = useRef(null)
  useInclinacion(retrato)

  // "Mateo Rodríguez" → "Mateo" arriba y el resto debajo.
  const [nombre, ...apellidos] = p(textos['hero.nombre']).split(' ')
  const [disponible, ...etiquetas] = p(textos['hero.etiquetas'])
  const ficha = p(textos['hero.ficha'])

  return (
    <section id="inicio" className="hero">
      <div className="hero-meta">
        <span className="pill">
          <i className="dot" aria-hidden="true" />
          {disponible}
        </span>
        <span className="pill">{etiquetas.join(' · ')}</span>
        <span className="pill pill-fin">{t('hero.edicion')}</span>
      </div>

      <h1 className="name">
        <span className="ln">{nombre}</span>
        <span className="ln name-2">{apellidos.join(' ')}</span>
      </h1>

      <div className="stage">
        <div className="hero-left">
          <p className="lede">{p(textos['hero.entradilla'])}</p>
          <p className="scrollcue" aria-hidden="true">
            <i />
            {t('hero.desplazate')}
          </p>
        </div>

        <figure className="portrait" ref={retrato}>
          <picture>
            <source type="image/avif" srcSet={srcset(avif400, avif660)} sizes={SIZES} />
            <source type="image/webp" srcSet={srcset(webp400, webp660)} sizes={SIZES} />
            <img
              src={jpg660}
              srcSet={srcset(jpg400, jpg660)}
              sizes={SIZES}
              width="660"
              height="768"
              alt={t('hero.retrato_alt')}
              fetchpriority="high"
            />
          </picture>
          <div className="tint" aria-hidden="true" />
          <div className="scan" aria-hidden="true" />
          <figcaption aria-hidden="true">
            <span>MR_2026</span>
            <span>{lang.toUpperCase()}</span>
          </figcaption>
        </figure>

        <div className="hero-right">
          <dl className="spec">
            {ficha.map(({ clave, valor }) => (
              <div key={clave}>
                <dt>{clave}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <Marquee />
    </section>
  )
}
