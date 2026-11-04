import { useState } from 'react'
import { pedir } from '@/panel/utilidades/api.js'
import Dialogo from '@/panel/comun/Dialogo.jsx'
import { Banda } from '@/panel/comun/Estados.jsx'
import { useSinGuardar } from '@/panel/comun/sinGuardar.js'

const PASOS = [
  { id: 'foto', texto: 'Guardar la foto del contenido', tarda: 'al momento' },
  { id: 'cv', texto: 'Generar el CV en PDF (con la prueba ATS)', tarda: '~10 s' },
  { id: 'despliegue', texto: 'Desplegar la web en Vercel', tarda: '~1 min' },
]
const ICONOS = { espera: '·', curso: '◌', ok: '✓', mal: '✕', nada: '–' }
const INICIO = { foto: ['espera'], cv: ['espera'], despliegue: ['espera'] }

// El diálogo de Publicar (aprobado en ADM-00): qué cambiará en la web y los tres pasos, que
// avanzan uno a uno (cada uno es una llamada a la API, ver api/publicar.py). Mientras
// publica no se puede cerrar. Si Vercel falla, la foto ya está guardada y se puede
// reintentar solo ese paso.
export default function DialogoPublicar({ abierto, pendientes, alCerrar, alPublicado }) {
  const sinGuardar = useSinGuardar()
  const [pasos, setPasos] = useState(INICIO) // { paso: [estado, nota] }
  const [publicacion, setPublicacion] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  const poner = (paso, estado, nota) => setPasos((p) => ({ ...p, [paso]: [estado, nota] }))
  const terminado = publicacion && !trabajando

  const desplegar = async (pub) => {
    poner('despliegue', 'curso')
    const r = await pedir(`/publicar/${pub.id}/despliegue`, { method: 'POST' })
    if (!r.ok) {
      poner('despliegue', 'mal', 'no se ha podido llamar')
      return pub
    }
    const d = r.datos
    if (d.despliegue === 'deployed') poner('despliegue', 'ok', 'en marcha')
    else if (d.despliegue === 'not_configured') poner('despliegue', 'nada', 'sin configurar (llega con GO-02)')
    else poner('despliegue', 'mal', d.despliegue_detalle)
    setPublicacion(d)
    return d
  }

  const publicar = async () => {
    setTrabajando(true)
    setError(null)
    setPasos(INICIO)
    poner('foto', 'curso')
    const foto = await pedir('/publicar', { method: 'POST' })
    if (!foto.ok) {
      poner('foto', 'mal')
      setError(
        foto.error === 'sin_cambios'
          ? 'No hay nada que publicar: la web ya está al día.'
          : foto.error === 'demasiado_grande'
            ? foto.datos.detalle
            : 'No se ha podido publicar. No ha cambiado nada en la web.',
      )
      setTrabajando(false)
      return
    }
    let pub = foto.datos
    setPublicacion(pub)
    poner('foto', 'ok', `nº ${pub.id}`)

    if (pub.cv === 'pending') {
      poner('cv', 'curso')
      const cv = await pedir(`/publicar/${pub.id}/cv`, { method: 'POST' })
      if (cv.ok) {
        pub = cv.datos
        setPublicacion(pub)
        poner('cv', pub.cv === 'generated' ? 'ok' : 'mal', pub.cv === 'generated' ? 'prueba ATS superada' : 'no superada')
      } else poner('cv', 'mal', 'no se ha podido generar')
    } else poner('cv', 'nada', 'el CV no ha cambiado')

    await desplegar(pub)
    setTrabajando(false)
    alPublicado()
  }

  const reintentar = async () => {
    setTrabajando(true)
    await desplegar(publicacion)
    setTrabajando(false)
    alPublicado()
  }

  const cerrar = () => {
    if (trabajando) return
    setPasos(INICIO)
    setPublicacion(null)
    setError(null)
    alCerrar()
  }

  return (
    <Dialogo abierto={abierto} titulo="Publicar los cambios" alCerrar={cerrar} cerrable={!trabajando}>
      {!publicacion && (
        <>
          <p>Esto es lo que cambiará en la web:</p>
          {pendientes.length > 0 ? (
            <ul>
              {pendientes.map((c) => {
                // "Proyecto CleanFlow · editado": lo primero en negrita, como en la maqueta.
                const corte = c.lastIndexOf(' · ')
                const [que, como] = corte < 0 ? [c, ''] : [c.slice(0, corte), c.slice(corte)]
                return (
                  <li key={c}>
                    <b>{que}</b>
                    {como}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p>Nada: la web ya está al día.</p>
          )}
          {sinGuardar > 0 && (
            <Banda tipo="aviso">
              <b>{sinGuardar === 1 ? 'Tienes 1 cambio sin guardar' : `Tienes ${sinGuardar} cambios sin guardar`}</b> en esta
              pantalla: no se publicarán. Guárdalos antes si quieres que salgan.
            </Banda>
          )}
        </>
      )}

      <ol className="pasos" aria-live="polite">
        {PASOS.map((p, i) => {
          const [estado, nota] = pasos[p.id]
          return (
            <li key={p.id} className={estado}>
              <span className="ic" aria-hidden="true">
                {estado === 'espera' ? i + 1 : ICONOS[estado]}
              </span>
              {p.texto}
              <small>{nota ?? p.tarda}</small>
            </li>
          )
        })}
      </ol>

      {error && <Banda tipo="error">{error}</Banda>}
      {terminado && publicacion.cv === 'failed' && (
        <Banda tipo="error">
          <b>El CV no se ha generado: no pasa la prueba ATS.</b> {publicacion.cv_detalle?.replace(/\.?$/, '.')}{' '}
          <b>El PDF anterior sigue publicado.</b>
        </Banda>
      )}
      {terminado && publicacion.despliegue === 'failed' && (
        <Banda tipo="error">
          <b>La publicación nº {publicacion.id} se guardó, pero el despliegue en Vercel falló</b> ({publicacion.despliegue_detalle?.replace(/\.$/, '')}).
          La web ya enseña lo nuevo; la copia de seguridad que lleva dentro, todavía no.
        </Banda>
      )}
      {terminado && publicacion.despliegue !== 'failed' && (
        <Banda tipo="ok">
          <b>Publicado.</b> La web ya enseña lo nuevo.
        </Banda>
      )}

      <div className="acciones">
        {!publicacion ? (
          <>
            <button className="boton suave" type="button" onClick={cerrar} disabled={trabajando} data-enfoque>
              Cancelar
            </button>
            <button className="boton azul" type="button" onClick={publicar} disabled={trabajando || pendientes.length === 0}>
              {trabajando ? 'Publicando…' : 'Publicar ahora'}
            </button>
          </>
        ) : (
          <>
            {terminado && publicacion.despliegue === 'failed' && (
              <button className="boton suave" type="button" onClick={reintentar}>
                Reintentar el despliegue
              </button>
            )}
            <button className="boton azul" type="button" onClick={cerrar} disabled={trabajando}>
              {trabajando ? 'Publicando…' : 'Cerrar'}
            </button>
          </>
        )}
      </div>
    </Dialogo>
  )
}
