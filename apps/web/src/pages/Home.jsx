import About from '@/sections/About.jsx'
import Activity from '@/sections/Activity.jsx'
import Contact from '@/sections/Contact.jsx'
import Hero from '@/sections/Hero.jsx'
import Projects from '@/sections/Projects.jsx'
import Skills from '@/sections/Skills.jsx'
import Timeline from '@/sections/Timeline.jsx'

// La portada: todas las secciones, en el orden de SECCIONES (el del menú).
export default function Home() {
  return (
    <main id="contenido" tabIndex={-1}>
      <Hero />
      <About />
      <Activity />
      <Skills />
      <Projects />
      <Timeline />
      <Contact />
    </main>
  )
}
