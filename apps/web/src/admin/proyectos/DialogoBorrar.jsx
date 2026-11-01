import { useEffect, useState } from 'react'
import { pedir } from '@/admin/api.js'
import Dialogo from '@/admin/comun/Dialogo.jsx'
import { useAvisar } from '@/admin/comun/avisos.js'

const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)

// Borrar un proyecto (aprobado en ADM-00): dice qué se pierde antes de hacerlo. Pide el
// proyecto entero al abrirse, para saber sus tecnologías, sus imágenes y si lo usa el CV.
export default function DialogoBorrar({ proyecto, alCerrar, alBorrar }) {
  const avisar = useAvisar()
  const [detalle, setDetalle] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const nombre = proyecto?.name?.es || proyecto?.slug

  useEffect(() => {
    if (!proyecto) return undefined
    let vivo = true
    pedir(`/projects/${proyecto.id}`).then((r) => vivo && setDetalle(r.ok ? r.datos : { error: true }))
    return () => {
      vivo = false
      setDetalle(null)
    }
  }, [proyecto])

  const borrar = async () => {
    setBorrando(true)
    const r = await pedir(`/projects/${proyecto.id}`, { method: 'DELETE' })
    setBorrando(false)
    if (!r.ok) {
      avisar('error', r.error === 'red' ? 'No se ha borrado: no hay conexión con la API.' : 'No se ha podido borrar.')
      return
    }
    avisar('ok', `${nombre} borrado`)
    alBorrar()
  }

  return (
    <Dialogo abierto={Boolean(proyecto)} titulo={`Borrar ${nombre ?? ''}`} alCerrar={borrando ? undefined : alCerrar}>
      <p>Esto es lo que pasa:</p>
      {detalle && !detalle.error ? (
        <ul>
          {detalle.status === 'published' ? (
            <li>
              Desaparece de la web <b>al publicar</b> (hasta entonces sigue visible).
            </li>
          ) : (
            <li>Es un borrador: si llegó a estar en la web, desaparece al publicar.</li>
          )}
          {detalle.technologies.length > 0 && (
            <li>
              Sus <b>{plural(detalle.technologies.length, 'tecnología', 'tecnologías')}</b> dejan de estar asociadas (no se
              borran de la lista).
            </li>
          )}
          {detalle.imagenes > 0 && (
            <li>
              Sus <b>{plural(detalle.imagenes, 'imagen', 'imágenes')}</b> se borran también.
            </li>
          )}
          {detalle.en_cv.map((titulo) => (
            <li key={titulo}>
              El CV lo usa en «{titulo}»: <b>habrá que cambiar ese enganche</b>.
            </li>
          ))}
        </ul>
      ) : (
        <p aria-busy={!detalle}>{detalle?.error ? 'No se ha podido comprobar qué más se pierde.' : 'Comprobando…'}</p>
      )}
      <p>
        <b>No se puede deshacer.</b>
        {detalle?.status !== 'draft' && ' Si solo quieres quitarlo de la web, márcalo como borrador.'}
      </p>
      <div className="acciones">
        <button className="boton suave" type="button" onClick={alCerrar} disabled={borrando} data-enfoque>
          Cancelar
        </button>
        <button className="boton peligro lleno" type="button" onClick={borrar} disabled={borrando || !detalle}>
          {borrando ? 'Borrando…' : `Borrar ${nombre ?? ''}`}
        </button>
      </div>
    </Dialogo>
  )
}
