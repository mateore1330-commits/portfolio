import { Outlet, ScrollRestoration } from 'react-router'
import ProveedorContenido from '@/contenido/ProveedorContenido.jsx'
import ProveedorContribuciones from '@/contenido/ProveedorContribuciones.jsx'
import ProveedorTema from '@/tema/ProveedorTema.jsx'

// React Router guarda dónde estabas en cada página con una clave. Todas las cargas desde cero
// comparten la misma ("default"), así que al abrir un enlace directo a una sección (/#contacto)
// recuperaba la posición de la carga anterior en vez de bajar a la sección (#158). Con #, cada
// carga tiene la suya: baja a la sección, y "Atrás" en la misma visita sigue volviendo.
const CARGA = Date.now().toString(36)
const claveScroll = (location) => (location.key === 'default' && location.hash ? `${CARGA}${location.hash}` : location.key)

// Layout común a todas las páginas: aquí irán la cabecera y el pie.
export default function Aplicacion() {
  return (
    <ProveedorTema>
      <ProveedorContenido>
        <ProveedorContribuciones>
          <Outlet />
          {/* Al entrar en una página, arriba (o en la sección del #); con "Atrás", donde estabas. */}
          <ScrollRestoration getKey={claveScroll} />
        </ProveedorContribuciones>
      </ProveedorContenido>
    </ProveedorTema>
  )
}
