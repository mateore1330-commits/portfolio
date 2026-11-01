import { useId } from 'react'

const IDIOMAS = [
  { lang: 'es', nombre: 'Español' },
  { lang: 'en', nombre: 'English' },
]

// Las pestañas Español / English de los formularios. Cada pestaña lleva un punto ámbar si
// tiene cambios y "falta" si tiene algo que revisar. Con las flechas se pasa de una a otra.
// Los dos idiomas están siempre en la página (el oculto, con hidden): así lo escrito en uno
// no se pierde al cambiar al otro.
export default function PestanasIdioma({ actual, alCambiar, conCambios = {}, conErrores = {}, children }) {
  const base = useId()

  const teclas = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const otro = IDIOMAS.find((i) => i.lang !== actual).lang
    alCambiar(otro)
    document.getElementById(`${base}-${otro}`)?.focus()
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Idioma">
        {IDIOMAS.map(({ lang, nombre }) => (
          <button
            key={lang}
            id={`${base}-${lang}`}
            role="tab"
            type="button"
            aria-selected={actual === lang}
            aria-controls={`${base}-panel-${lang}`}
            tabIndex={actual === lang ? 0 : -1}
            className={conCambios[lang] ? 'con-cambios' : undefined}
            onClick={() => alCambiar(lang)}
            onKeyDown={teclas}
          >
            {nombre}
            {conErrores[lang] && <span className="chip aviso">falta</span>}
          </button>
        ))}
      </div>
      {IDIOMAS.map(({ lang }) => (
        <div
          key={lang}
          id={`${base}-panel-${lang}`}
          className="panel-idioma"
          role="tabpanel"
          aria-labelledby={`${base}-${lang}`}
          hidden={actual !== lang}
        >
          {children(lang)}
        </div>
      ))}
    </>
  )
}
