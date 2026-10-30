import { useContent } from '@/content/useContent.js'
import { usePick, useT } from '@/i18n/useLang.js'
import ContactForm from '@/sections/ContactForm.jsx'
import DotField from '@/sections/DotField.jsx'
import '@/sections/contact.css'

// El contacto: panel negro en los dos temas con el campo de puntos. A la izquierda,
// "Hablamos", el texto y los canales; a la derecha, el formulario (maqueta aprobada el
// 30/10/2026: Recursos/Maquetas/contacto-formulario-y-pie.html, opción A).
export default function Contact() {
  const t = useT()
  const p = usePick()
  const { site_texts: textos, links } = useContent()
  const correo = links.find((l) => l.type === 'email')?.url.replace(/^mailto:/, '') ?? ''

  return (
    <section id="contacto" className="contact">
      <DotField />
      <div className="contact-dentro">
        <div className="contact-texto">
          <p className="hint" aria-hidden="true">
            {t('contacto.pista')}
          </p>
          <h2>{p(textos['contacto.titular'])}</h2>
          {p(textos['contacto.texto']).map((parrafo) => (
            <p key={parrafo} className="sub">
              {parrafo}
            </p>
          ))}
          <ul className="chans">
            {links.map((enlace) => {
              const fuera = !enlace.url.startsWith('mailto:')
              return (
                <li key={enlace.url}>
                  <a href={enlace.url} {...(fuera && { target: '_blank', rel: 'noopener noreferrer' })}>
                    {p(enlace.label)}
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
