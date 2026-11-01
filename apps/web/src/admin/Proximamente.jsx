import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { Cabecera, Vacio } from '@/admin/comun/Estados.jsx'
import { RUTA_PANEL } from '@/admin/ruta.js'
import { SECCIONES } from '@/admin/secciones.js'
import { ponerTitulo } from '@/i18n/documento.js'

// Las secciones del menú que todavía no existen (decidido en ADM-02): dicen qué issue las
// construye. Cuando una existe, su ruta propia en routes.jsx pasa por delante de esta.
// Una dirección que no es ninguna sección es un "no encontrado" del panel.
export default function Proximamente() {
  const { seccion: ruta } = useParams()
  const seccion = SECCIONES.find((s) => s.ruta && s.ruta === ruta && s.issue)

  useEffect(() => {
    ponerTitulo(`${seccion?.nombre ?? 'No encontrado'} · Panel`)
  }, [seccion])

  if (!seccion) return <NoEncontrado />

  return (
    <>
      <Cabecera titulo={seccion.nombre} texto={seccion.que} />
      <Vacio titulo={`Llega en ${seccion.issue}`}>
        <p>Esta pantalla ya está diseñada (en la maqueta del panel) y se construye en la issue {seccion.issue}.</p>
      </Vacio>
    </>
  )
}

export function NoEncontrado() {
  useEffect(() => {
    ponerTitulo('No encontrado · Panel')
  }, [])
  return (
    <>
      <Cabecera titulo="No encontrado" />
      <Vacio icono="?" titulo="Esta pantalla no existe">
        <p>Puede que la dirección esté mal escrita.</p>
        <Link className="boton suave" to={RUTA_PANEL}>
          ← Volver al inicio
        </Link>
      </Vacio>
    </>
  )
}
