import SobreMi from '@/web/secciones/SobreMi.jsx'
import Actividad from '@/web/secciones/Actividad.jsx'
import Contacto from '@/web/secciones/Contacto.jsx'
import Inicio from '@/web/secciones/Inicio.jsx'
import Proyectos from '@/web/secciones/Proyectos.jsx'
import Conocimientos from '@/web/secciones/Conocimientos.jsx'
import Trayectoria from '@/web/secciones/Trayectoria.jsx'

// La portada: todas las secciones, en el orden de SECCIONES (el del menú).
export default function Portada() {
  return (
    <main id="contenido" tabIndex={-1}>
      <Inicio />
      <SobreMi />
      <Actividad />
      <Conocimientos />
      <Proyectos />
      <Trayectoria />
      <Contacto />
    </main>
  )
}
