import Marcado from '@/content/Marcado.jsx'
import { useContent } from '@/content/useContent.js'
import { usePick, useT } from '@/i18n/useLang.js'
import ContactForm from '@/sections/ContactForm.jsx'
import DotField from '@/sections/DotField.jsx'
import '@/sections/contact.css'

// El dato visible de cada canal: el correo, el nombre (LinkedIn) o el usuario (GitHub).
function datoDe(enlace, nombre) {
  if (enlace.type === 'email') return enlace.url.replace(/^mailto:/, '')
  if (enlace.type === 'github') return enlace.url.replace(/\/+$/, '').split('/').pop()
  return nombre
}

// El cierre de la web: panel negro en los dos temas con el campo de puntos. Arriba, a
// todo el ancho, la etiqueta de disponibilidad y el titular (la parte marcada, en azul).
// Debajo, el texto y los canales a la izquierda y el formulario a la derecha.
// Propuesta aprobada el 31/10/2026 (Recursos/Maquetas/contacto-propuesta.html).
export default function Contact() {
  const t = useT()
  const p = usePick()
  const { site_texts: textos, links } = useContent()
  const nombre = p(textos['hero.nombre'])
  const correo = links.find((l) => l.type === 'email')?.url.replace(/^mailto:/, '') ?? ''

  return (
    <section id="contacto" className="contact">
      <DotField />
      <div className="contact-halo" aria-hidden="true" />
      <div className="contact-dentro">
        <div className="contact-cabecera">
          <p className="contact-pill">
            <i className="dot" aria-hidden="true" />
            {t('contacto.disponible')}
          </p>
          <h2>
            <Marcado texto={p(textos['contacto.titular'])} />
          </h2>
        </div>

        <div className="contact-texto">
          {p(textos['contacto.texto']).map((parrafo) => (
            <p key={parrafo} className="sub">
              <Marcado texto={parrafo} />
            </p>
          ))}
          <ul className="canales">
            {links.map((enlace) => {
              const fuera = !enlace.url.startsWith('mailto:')
              return (
                <li key={enlace.url}>
                  <a href={enlace.url} {...(fuera && { target: '_blank', rel: 'noopener noreferrer' })}>
                    <span className="k">{t(`contacto.canal_${enlace.type}`)}</span>
                    <span className="v">{datoDe(enlace, nombre)}</span>
                    <span className="f" aria-hidden="true">
                      ↗
                    </span>
                    {fuera && <span className="solo-lector"> {t('enlace.nueva_pestana')}</span>}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>

        <ContactForm correo={correo} boton={p(textos['contacto.boton'])} respaldo={p(textos['contacto.respaldo'])} />
      </div>
    </section>
  )
}
