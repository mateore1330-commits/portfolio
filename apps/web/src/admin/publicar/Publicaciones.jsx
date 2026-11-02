import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router'
import { pedir } from '@/admin/api.js'
import { useAvisar } from '@/admin/comun/avisos.js'
import { Banda, Cabecera, Vacio } from '@/admin/comun/Estados.jsx'
import { ponerTitulo } from '@/i18n/documento.js'

const FECHA = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
const fecha = (iso) => `${FECHA.format(new Date(iso))} · ${HORA.format(new Date(iso))}`
const kb = (bytes) => (bytes == null ? '—' : `${(bytes / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} KB`)

const ESTADOS = {
  deployed: ['pub', 'Desplegada'],
  failed: ['mal', 'Falló el despliegue'],
  not_configured: ['bor', 'Sin Vercel todavía'],
  pending: ['bor', 'Sin desplegar'],
}

// 3 · Publicaciones (aprobada en ADM-00): cada vez que se publica queda una foto. La web
// enseña siempre la última. Si su despliegue en Vercel falló, se puede reintentar aquí.
export default function Publicaciones() {
  const avisar = useAvisar()
  const { publicar, cargarResumen } = useOutletContext()
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)
  const [reintentando, setReintentando] = useState(false)

  useEffect(() => {
    ponerTitulo('Publicaciones · Panel')
  }, [])

  // Se vuelve a pedir cuando cambia la última publicación (al publicar desde la barra).
  const ultimaId = publicar?.ultima?.id
  useEffect(() => {
    let vivo = true
    pedir('/publicaciones').then((r) => {
      if (!vivo) return
      if (r.ok) setLista(r.datos)
      else setError(r.error)
    })
    return () => {
      vivo = false
    }
  }, [intento, ultimaId])

  const recargar = useCallback(() => {
    setError(null)
    setIntento((n) => n + 1)
  }, [])

  const reintentar = async (p) => {
    setReintentando(true)
    const r = await pedir(`/publicar/${p.id}/despliegue`, { method: 'POST' })
    setReintentando(false)
    if (r.ok && r.datos.despliegue === 'deployed') avisar('ok', 'Despliegue en marcha. Vercel tarda alrededor de un minuto.')
    else avisar('error', `El despliegue ha vuelto a fallar${r.datos?.despliegue_detalle ? ` (${r.datos.despliegue_detalle.replace(/\.$/, '')})` : ''}.`)
    recargar()
    cargarResumen()
  }

  const cabecera = (
    <Cabecera titulo="Publicaciones" texto="Cada vez que publicas se guarda una foto del contenido. La web siempre muestra la última." />
  )

  if (error) {
    return (
      <>
        {cabecera}
        <Banda
          tipo="error"
          acciones={
            <button className="boton pequeno" type="button" onClick={recargar}>
              Reintentar
            </button>
          }
        >
          <b>No se ha podido cargar el historial.</b> {error === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
        </Banda>
      </>
    )
  }

  if (!lista) {
    return (
      <>
        {cabecera}
        <div className="filas-cargando" aria-busy="true" aria-label="Cargando las publicaciones">
          {Array.from({ length: 5 }, (_, i) => (
            <span className="hueco" key={i} />
          ))}
        </div>
      </>
    )
  }

  if (lista.length === 0) {
    return (
      <>
        {cabecera}
        <Vacio icono="↑" titulo="Todavía no has publicado nada">
          <p>Cuando guardes cambios, la barra de arriba te dirá cuántos hay y podrás publicarlos con «Publicar →».</p>
        </Vacio>
      </>
    )
  }

  const [ultima, anterior] = lista
  return (
    <>
      {cabecera}
      {ultima.despliegue === 'failed' && (
        <Banda
          tipo="error"
          acciones={
            <button className="boton pequeno" type="button" onClick={() => reintentar(ultima)} disabled={reintentando}>
              {reintentando ? 'Reintentando…' : 'Reintentar el despliegue'}
            </button>
          }
        >
          <b>La publicación nº {ultima.id} se guardó, pero el despliegue en Vercel falló</b> ({ultima.despliegue_detalle?.replace(/\.$/, '')}).
          {anterior ? ` La copia que lleva la web dentro sigue siendo la nº ${anterior.id}.` : ''}
        </Banda>
      )}
      <table className="tabla">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Fecha</th>
            <th>Qué cambió</th>
            <th className="ocultar-movil">Tamaño</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => {
            const [clase, texto] = ESTADOS[p.despliegue] ?? ESTADOS.pending
            return (
              <tr key={p.id}>
                <td className="fecha">#{p.id}</td>
                <td className="fecha">{fecha(p.fecha)}</td>
                <td>
                  {p.cambios.length > 0 ? p.cambios.join(' · ') : <span className="gris">Publicada con el comando</span>}
                  {p.cv === 'failed' && <p className="nota-celda">El CV no pasó la prueba ATS: se quedó el anterior.</p>}
                </td>
                <td className="fecha ocultar-movil">{kb(p.tamano)}</td>
                <td>
                  <span className={`chip ${clase}`}>
                    <i />
                    {texto}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
