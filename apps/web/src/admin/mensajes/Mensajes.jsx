import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router'
import { pedir } from '@/admin/api.js'
import { useAvisar } from '@/admin/comun/avisos.js'
import Dialogo from '@/admin/comun/Dialogo.jsx'
import { Banda, Cabecera, Vacio } from '@/admin/comun/Estados.jsx'
import { haceCuanto } from '@/admin/fechas.js'
import { ponerTitulo } from '@/i18n/documento.js'

const FILTROS = [
  { id: 'new', nombre: 'Sin leer', contar: true },
  { id: 'read', nombre: 'Leídos' },
  { id: 'replied', nombre: 'Respondidos' },
  { id: 'spam', nombre: 'Spam', contar: true },
  { id: 'todos', nombre: 'Todos', contar: true },
]
const VACIOS = {
  new: ['No tienes mensajes sin leer', 'Cuando alguien te escriba desde la web, aparecerá aquí y te llegará un aviso al correo.'],
  read: ['No hay mensajes leídos', 'Los que abras y no respondas quedan aquí.'],
  replied: ['No hay mensajes respondidos', 'Cuando respondas uno desde tu correo, márcalo como respondido.'],
  spam: ['No hay spam', 'Lo que marques como spam queda aquí hasta que se borre solo a los 12 meses.'],
  todos: ['Todavía no te ha escrito nadie', 'Cuando alguien te escriba desde la web, aparecerá aquí y te llegará un aviso al correo.'],
}
const IDIOMAS = { es: 'Español', en: 'Inglés' }
const FECHA = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

const asunto = (m) => m.asunto || 'Sin asunto'
const responder = (m) => `mailto:${m.correo}?subject=${encodeURIComponent(`Re: ${m.asunto || 'Tu mensaje desde mi web'}`)}`

// 12 · Mensajes (aprobada en ADM-00): la bandeja del formulario de contacto. A la izquierda
// la lista; a la derecha, el mensaje abierto. Abrir uno sin leer lo marca como leído
// (decidido en ADM-10). El panel no envía correos: se responde desde el correo de Mateo y
// aquí se marca como respondido. El filtro y el mensaje abierto van en la dirección.
export default function Mensajes() {
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const estado = FILTROS.some((f) => f.id === params.get('estado')) ? params.get('estado') : 'new'
  const verId = Number(params.get('ver')) || null
  const [datos, setDatos] = useState(null) // { lista, cuantos, fallidos }
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)
  const [aBorrar, setABorrar] = useState(null)
  const [reenviando, setReenviando] = useState(false)
  const detalle = useRef(null)
  // El que se ve a la derecha: el elegido o, si no, el primero.
  const abierto = datos?.lista.find((m) => m.id === verId) ?? datos?.lista[0]

  useEffect(() => {
    ponerTitulo('Mensajes · Panel')
  }, [])

  useEffect(() => {
    let vivo = true
    pedir(`/messages${estado === 'todos' ? '' : `?estado=${estado}`}`).then((r) => {
      if (!vivo) return
      if (r.ok) setDatos(r.datos)
      else setError(r.error)
    })
    return () => {
      vivo = false
    }
  }, [estado, intento])

  const recargar = useCallback(() => {
    setError(null)
    setIntento((n) => n + 1)
  }, [])

  const ir = (cambios) => {
    const siguiente = new URLSearchParams(params)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor == null) siguiente.delete(clave)
      else siguiente.set(clave, valor)
    }
    setParams(siguiente, { replace: true })
  }

  // Lo que cuenta la API tras cada cambio: el número de cada filtro y los avisos fallidos.
  const ponerBandeja = (r) => setDatos((d) => ({ ...d, cuantos: r.cuantos, fallidos: r.fallidos }))

  const cambiarEstado = async (m, nuevo, aviso) => {
    const r = await pedir(`/messages/${m.id}`, { method: 'PATCH', body: JSON.stringify({ estado: nuevo }) })
    if (!r.ok) {
      avisar('error', 'No se ha guardado. Vuelve a probar.')
      return
    }
    setDatos((d) => ({ ...d, lista: d.lista.map((x) => (x.id === m.id ? r.datos.mensaje : x)) }))
    ponerBandeja(r.datos)
    cargarResumen()
    if (aviso) avisar('ok', aviso)
  }

  // El que se ve, si estaba sin leer, pasa a leído (se queda en la lista hasta cambiar de
  // filtro). Solo una vez por mensaje: "Marcar como no leído" no lo vuelve a marcar.
  const marcados = useRef(new Set())
  useEffect(() => {
    if (!abierto || abierto.estado !== 'new' || marcados.current.has(abierto.id)) return
    marcados.current.add(abierto.id)
    cambiarEstado(abierto, 'read')
    // cambiarEstado cambia en cada render; lo que importa es qué mensaje se ve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto?.id, abierto?.estado])

  const abrir = (m) => {
    ir({ ver: m.id })
    // En el móvil la lista va encima: se baja hasta el mensaje.
    if (window.matchMedia('(max-width: 900px)').matches) {
      requestAnimationFrame(() => detalle.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  const copiar = async (m) => {
    try {
      await navigator.clipboard.writeText(m.correo)
      avisar('ok', 'Correo copiado')
    } catch {
      avisar('error', 'No se ha podido copiar.')
    }
  }

  const borrar = async () => {
    const m = aBorrar
    const r = await pedir(`/messages/${m.id}`, { method: 'DELETE' })
    setABorrar(null)
    if (!r.ok) {
      avisar('error', 'No se ha podido borrar.')
      return
    }
    setDatos((d) => ({ ...d, lista: d.lista.filter((x) => x.id !== m.id) }))
    ponerBandeja(r.datos)
    ir({ ver: null })
    cargarResumen()
    avisar('ok', 'Mensaje borrado.')
  }

  const reenviar = async () => {
    setReenviando(true)
    const r = await pedir('/messages/reenviar', { method: 'POST' })
    setReenviando(false)
    if (!r.ok) {
      avisar('error', r.error === 'sin_correo' ? 'El correo no está configurado en el servidor (SMTP en el .env).' : 'No se ha podido reintentar.')
      return
    }
    ponerBandeja(r.datos)
    setDatos((d) => ({ ...d, lista: d.lista.map((x) => (r.datos.fallidos.some((f) => f.id === x.id) ? x : { ...x, aviso_enviado: true })) }))
    const { pendientes, enviados } = r.datos
    if (enviados === pendientes) avisar('ok', enviados === 1 ? 'Aviso reenviado.' : `${enviados} avisos reenviados.`)
    else avisar('error', `Se han reenviado ${enviados} de ${pendientes}. Los demás siguen pendientes.`)
  }

  const cabecera = <Cabecera titulo="Mensajes" texto="Lo que llega por el formulario de contacto. Se borran solos a los 12 meses." />

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
          <b>No se han podido cargar los mensajes.</b> {error === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
        </Banda>
      </>
    )
  }

  const filtros = (
    <div className="filtros" role="group" aria-label="Filtrar por estado">
      {FILTROS.map((f) => {
        const n = datos?.cuantos?.[f.id]
        return (
          <button key={f.id} type="button" aria-pressed={estado === f.id} onClick={() => ir({ estado: f.id === 'new' ? null : f.id, ver: null })}>
            {f.nombre}
            {f.contar && n > 0 && ` · ${n}`}
          </button>
        )
      })}
    </div>
  )

  if (!datos) {
    return (
      <>
        {cabecera}
        {filtros}
        <div className="filas-cargando" aria-busy="true" aria-label="Cargando los mensajes">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <span className="hueco grande" />
              <span className="hueco" />
            </div>
          ))}
        </div>
      </>
    )
  }

  const { lista, fallidos } = datos

  return (
    <>
      {cabecera}
      {filtros}

      {fallidos.length > 0 && (
        <Banda
          tipo="error"
          acciones={
            <button className="boton pequeno" type="button" onClick={reenviar} disabled={reenviando}>
              {reenviando ? 'Reintentando…' : 'Reintentar'}
            </button>
          }
        >
          <b>{fallidos.length === 1 ? '1 aviso por correo no llegó a enviarse' : `${fallidos.length} avisos por correo no llegaron a enviarse`}</b>{' '}
          ({fallidos.map((f) => `${f.nombre}, ${haceCuanto(f.fecha)}`).join('; ')}). {fallidos.length === 1 ? 'El mensaje está guardado.' : 'Los mensajes están guardados.'}
        </Banda>
      )}

      {lista.length === 0 ? (
        <Vacio icono="✉" titulo={VACIOS[estado][0]}>
          <p>{VACIOS[estado][1]}</p>
        </Vacio>
      ) : (
        <div className="bandeja">
          <nav className="lista" aria-label="Mensajes">
            {lista.map((m) => (
              <button
                key={m.id}
                type="button"
                className={m.estado === 'new' ? 'no-leido' : undefined}
                aria-current={m.id === abierto.id ? 'true' : undefined}
                onClick={() => abrir(m)}
              >
                <span className="de">
                  {m.nombre}
                  {m.estado === 'new' && <span className="solo-lector"> (sin leer)</span>}
                  <small>{haceCuanto(m.fecha)}</small>
                </span>
                <span className="asunto">{asunto(m)}</span>
              </button>
            ))}
          </nav>
          <Detalle
            m={abierto}
            refDetalle={detalle}
            alCopiar={() => copiar(abierto)}
            alEstado={(nuevo, aviso) => cambiarEstado(abierto, nuevo, aviso)}
            alBorrar={() => setABorrar(abierto)}
          />
        </div>
      )}

      <Dialogo abierto={Boolean(aBorrar)} titulo="Borrar el mensaje" alCerrar={() => setABorrar(null)}>
        <p>
          El mensaje de <b>{aBorrar?.nombre}</b> se borra para siempre. <b>No se puede deshacer.</b>
        </p>
        <div className="acciones">
          <button className="boton suave" type="button" onClick={() => setABorrar(null)} data-enfoque>
            Cancelar
          </button>
          <button className="boton peligro lleno" type="button" onClick={borrar}>
            Borrar el mensaje
          </button>
        </div>
      </Dialogo>
    </>
  )
}

function Detalle({ m, refDetalle, alCopiar, alEstado, alBorrar }) {
  const fecha = new Date(m.fecha)
  // "(hace 2 h)" o "(ayer)" solo si es reciente; si no, repetiría la fecha.
  const hace = haceCuanto(m.fecha)
  const reciente = /^(ahora|hace|ayer)/.test(hace)
  return (
    <article className="detalle" ref={refDetalle} aria-labelledby={`msg-${m.id}`}>
      <h2 id={`msg-${m.id}`}>{asunto(m)}</h2>
      <dl className="meta-msg">
        <dt>De</dt>
        <dd>
          {m.nombre} · {m.correo}{' '}
          <button className="enlace" type="button" onClick={alCopiar}>
            Copiar
          </button>
        </dd>
        <dt>Recibido</dt>
        <dd>
          {FECHA.format(fecha)} · {HORA.format(fecha)}
          {reciente && ` (${hace})`}
        </dd>
        <dt>Desde la web en</dt>
        <dd>{IDIOMAS[m.idioma] ?? '—'}</dd>
        <dt>Privacidad</dt>
        <dd>{m.privacidad_version ? `Aceptada · versión del ${m.privacidad_version}` : 'Sin registro (mensaje anterior a la casilla)'}</dd>
        <dt>Aviso por correo</dt>
        <dd className={m.aviso_enviado ? 'bien' : 'mal'}>{m.aviso_enviado ? '✓ Enviado' : '✕ No llegó a enviarse'}</dd>
      </dl>
      <p className="texto-msg">{m.mensaje}</p>
      <div className="acciones-msg">
        <a className="boton azul" href={responder(m)}>
          Responder en tu correo ↗
        </a>
        <button className="boton" type="button" onClick={alCopiar}>
          Copiar correo
        </button>
        {m.estado === 'replied' ? (
          <button className="boton" type="button" onClick={() => alEstado('read', 'Ya no está marcado como respondido.')}>
            Quitar «respondido»
          </button>
        ) : (
          <button className="boton" type="button" onClick={() => alEstado('replied', 'Marcado como respondido.')}>
            Marcar respondido
          </button>
        )}
        {m.estado === 'spam' ? (
          <button className="boton suave" type="button" onClick={() => alEstado('read', 'Ya no es spam.')}>
            No es spam
          </button>
        ) : (
          <button className="boton suave" type="button" onClick={() => alEstado('spam', 'Marcado como spam.')}>
            Spam
          </button>
        )}
        {m.estado !== 'new' && (
          <button className="boton suave" type="button" onClick={() => alEstado('new', 'Marcado como no leído.')}>
            Marcar como no leído
          </button>
        )}
        <button className="boton suave peligro" type="button" onClick={alBorrar}>
          Borrar
        </button>
      </div>
      <p className="nota-msg">La conversación sigue en tu correo: el panel no envía correos. Cuando respondas, márcalo como respondido.</p>
    </article>
  )
}
