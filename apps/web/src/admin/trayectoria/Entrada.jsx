import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router'
import { pedir } from '@/admin/api.js'
import AvisoSalir from '@/admin/comun/AvisoSalir.jsx'
import { useAvisar } from '@/admin/comun/avisos.js'
import Bloque, { Esqueleto } from '@/admin/comun/Bloque.jsx'
import Campo from '@/admin/comun/Campo.jsx'
import Dialogo from '@/admin/comun/Dialogo.jsx'
import { Banda, Cabecera } from '@/admin/comun/Estados.jsx'
import ListaParrafos from '@/admin/comun/ListaParrafos.jsx'
import PestanasIdioma from '@/admin/comun/PestanasIdioma.jsx'
import { conError, useFormulario } from '@/admin/comun/useFormulario.js'
import { NoEncontrado } from '@/admin/Proximamente.jsx'
import { RUTA_PANEL } from '@/admin/ruta.js'
import { RUTA_TRAYECTORIA, TIPOS, aApi, aFormulario, clavesParrafos, fechas, mensaje } from '@/admin/trayectoria/campos.js'
import { ponerTitulo } from '@/i18n/documento.js'

const cambios = (n) => (n === 1 ? '1 cambio' : `${n} cambios`)
const esteMes = () => new Date().toISOString().slice(0, 7)

// 10 · Empleo y formación (aprobadas en ADM-00). Crear y editar son la misma pantalla, y
// empleo y formación comparten casi todo: lo que cambia está en campos.js (TIPOS).
// Cada dirección es un formulario nuevo (key): de "nuevo" a "12" al guardar, se empieza limpio.
export function Empleo() {
  return <Entrada tipo={TIPOS.empleo} />
}

export function Formacion() {
  return <Entrada tipo={TIPOS.formacion} />
}

function Entrada({ tipo }) {
  const { id } = useParams()
  if (id !== undefined && !/^\d+$/.test(id)) return <NoEncontrado />
  return <Formulario key={`${tipo.nombre}-${id ?? 'nuevo'}`} tipo={tipo} id={id} />
}

function Formulario({ tipo, id }) {
  const nuevo = id === undefined
  const empleo = tipo === TIPOS.empleo
  const navigate = useNavigate()
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const form = useFormulario(clavesParrafos(tipo))
  const { valores, original, cuantos } = form

  const [carga, setCarga] = useState('cargando')
  const [intento, setIntento] = useState(0)
  const [detalle, setDetalle] = useState(null)
  const [idioma, setIdioma] = useState('es')
  const [errores, setErrores] = useState({})
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [solapes, setSolapes] = useState([])
  const [borrar, setBorrar] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [irA, setIrA] = useState(null)

  useEffect(() => {
    let vivo = true
    const pedido = nuevo ? Promise.resolve({ ok: true, datos: null }) : pedir(`${tipo.api}/${id}`)
    pedido.then((r) => {
      if (!vivo) return
      if (!r.ok) {
        setCarga(r.error === 'no_existe' || r.error === 'red' ? r.error : 'servidor')
        return
      }
      setDetalle(r.datos)
      form.cargar(aFormulario(tipo, r.datos ?? {}))
      setCarga('lista')
    })
    return () => {
      vivo = false
    }
    // form.cargar no cambia nunca (useCallback sin dependencias).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nuevo, intento, tipo])

  const nombreGuardado = detalle?.[tipo.titulo]?.es || detalle?.slug
  useEffect(() => {
    ponerTitulo(`${nombreGuardado ?? tipo.nuevo} · Panel`)
  }, [nombreGuardado, tipo])

  // Navegar después de pintar: así el aviso de salir ya sabe que no quedan cambios.
  useEffect(() => {
    if (irA) navigate(irA, { replace: true })
  }, [irA, navigate])

  if (carga === 'no_existe') return <NoEncontrado />

  const lista = `${RUTA_TRAYECTORIA}${empleo ? '' : '?ver=formacion'}`
  const volver = (
    <Link className="volver" to={lista}>
      ← Trayectoria
    </Link>
  )

  if (carga !== 'lista') {
    return (
      <>
        {volver}
        <Cabecera titulo={nuevo ? tipo.nuevo : empleo ? 'Empleo' : 'Formación'} />
        {carga === 'cargando' ? (
          <Esqueleto etiqueta={`Cargando ${empleo ? 'el empleo' : 'la formación'}`} />
        ) : (
          <Banda
            tipo="error"
            acciones={
              <button
                className="boton pequeno"
                type="button"
                onClick={() => {
                  setCarga('cargando')
                  setIntento((n) => n + 1)
                }}
              >
                Reintentar
              </button>
            }
          >
            <b>No se ha podido abrir.</b> {carga === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
          </Banda>
        )}
      </>
    )
  }

  // --- Cambiar un campo: su error de la API se quita (ya no es lo que se envió).
  const cambiar = (clave, valor) => {
    form.poner(clave, valor)
    setErrores((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== clave && !k.startsWith(`${clave}.`))))
  }
  const deshacer = (clave) => cambiar(clave, original[clave])
  const errorDe = (clave) => (errores[clave] ? mensaje(clave, errores[clave]) : null)
  const marca = (clave) => ({ cambiado: form.cambiado(clave), alDeshacer: () => deshacer(clave) })

  const total = cuantos()
  const numErrores = Object.keys(errores).length
  const erroresEn = (lang) => Object.keys(errores).some((k) => k.split('.')[1] === lang)

  const guardar = async () => {
    setGuardando(true)
    setFallo(null)
    const r = await pedir(nuevo ? tipo.api : `${tipo.api}/${id}`, {
      method: nuevo ? 'POST' : 'PUT',
      body: JSON.stringify(aApi(tipo, valores)),
    })
    setGuardando(false)
    if (!r.ok) {
      if (r.error === 'validacion') {
        setErrores(r.datos.errores)
        const langs = ['es', 'en'].filter((l) => Object.keys(r.datos.errores).some((k) => k.split('.')[1] === l))
        if (langs.length && !langs.includes(idioma)) setIdioma(langs[0])
      } else setFallo(r.error)
      return
    }
    setErrores({})
    setDetalle(r.datos)
    setSolapes(r.datos.solapes ?? [])
    form.cargar(aFormulario(tipo, r.datos))
    cargarResumen()
    avisar('ok', r.datos.is_visible ? 'Guardado. Se verá en la web al publicar.' : `Guardado. Está ocult${tipo.o}: no sale en la web.`)
    if (nuevo) setIrA(`${tipo.ruta}/${r.datos.id}`)
  }

  const descartar = () => {
    form.descartar()
    setErrores({})
    setFallo(null)
  }

  const confirmarBorrar = async () => {
    setBorrando(true)
    const r = await pedir(`${tipo.api}/${id}`, { method: 'DELETE' })
    setBorrando(false)
    if (!r.ok) {
      avisar('error', r.error === 'en_cv' ? `El CV ${empleo ? 'lo' : 'la'} usa: quíta${empleo ? 'lo' : 'la'} del CV antes de borrar${empleo ? 'lo' : 'la'}.` : 'No se ha podido borrar.')
      setBorrar(false)
      return
    }
    avisar('ok', `${nombreGuardado} borrad${tipo.o}`)
    descartar()
    cargarResumen()
    setIrA(lista)
  }

  // --- Piezas que se repiten
  const campoTexto = (clave, etiqueta, { tipo: tipoInput = 'text', ayuda, ...resto } = {}) => {
    const idCampo = `c-${clave.replace('.', '-')}`
    const error = errorDe(clave)
    return (
      <Campo key={clave} etiqueta={etiqueta} id={idCampo} ayuda={ayuda} error={error} {...marca(clave)}>
        <input id={idCampo} type={tipoInput} value={valores[clave]} onChange={(e) => cambiar(clave, e.target.value)} {...conError(idCampo, error)} {...resto} />
      </Campo>
    )
  }

  const erroresParrafos = (clave) =>
    Object.fromEntries(
      Object.entries(errores)
        .filter(([k]) => k.startsWith(`${clave}.`))
        .map(([k, codigo]) => [k.split('.')[2], mensaje(k, codigo)]),
    )

  const actualmente = valores.end_date === ''
  const titulo = nombreGuardado ?? tipo.nuevo
  const donde = empleo ? detalle?.company : detalle?.institution
  const usosCv = detalle?.en_cv ?? []
  const archivo = valores.certificate_file

  return (
    <>
      {volver}
      <Cabecera
        titulo={titulo}
        texto={
          nuevo
            ? 'Todavía sin guardar. Nacerá al final de la lista.'
            : `${donde ? `${donde} · ` : ''}${fechas(detalle.start_date, detalle.end_date)}`
        }
      />

      {total > 0 && (
        <Banda
          tipo="aviso"
          acciones={
            <>
              <button className="boton suave pequeno" type="button" onClick={descartar}>
                Descartar
              </button>
              <button className="boton azul pequeno" type="button" onClick={guardar} disabled={guardando}>
                Guardar
              </button>
            </>
          }
        >
          <b>Tienes {cambios(total)} sin guardar</b>. Están marcados en ámbar; si sales ahora, te avisaré.
        </Banda>
      )}
      {numErrores > 0 && (
        <Banda tipo="error">
          <b>No se ha guardado.</b> {numErrores === 1 ? 'Hay 1 cosa que revisar' : `Hay ${numErrores} cosas que revisar`}: está
          marcado en rojo
          {(erroresEn('es') || erroresEn('en')) && ', y la pestaña del idioma dice «falta»'}.
          {valores.is_visible && ' Oculta se puede guardar a medias; para que se vea en la web, tiene que estar completa.'}
        </Banda>
      )}
      {fallo && (
        <Banda tipo="error">
          <b>No se ha guardado.</b> {fallo === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'} Lo que has
          escrito sigue aquí.
        </Banda>
      )}
      {solapes.length > 0 && (
        <Banda tipo="info">
          <b>Aviso:</b> se solapa con {solapes.map(([a, b]) => (String(a.id) === id ? b : a).empresa).join(', ')}. Es solo un
          aviso: puede ser correcto.
        </Banda>
      )}

      <form className="form" noValidate onSubmit={(e) => e.preventDefault()}>
        <Bloque
          n="01"
          titulo="Textos"
          cambios={cuantos((k) => /\.(es|en)$/.test(k))}
          texto={empleo ? 'Lo que se lee en la trayectoria de la web.' : 'Lo que se lee en la formación de la web.'}
        >
          <PestanasIdioma
            actual={idioma}
            alCambiar={setIdioma}
            conCambios={{ es: cuantos((k) => k.endsWith('.es')) > 0, en: cuantos((k) => k.endsWith('.en')) > 0 }}
            conErrores={{ es: erroresEn('es'), en: erroresEn('en') }}
          >
            {(lang) => (
              <>
                {tipo.textos.map(({ campo, etiqueta }) => campoTexto(`${campo}.${lang}`, etiqueta))}
                {tipo.parrafos.map(({ campo, etiqueta, lineas }) => {
                  const clave = `${campo}.${lang}`
                  return (
                    <ListaParrafos
                      key={clave}
                      etiqueta={etiqueta}
                      valor={valores[clave]}
                      original={original[clave]}
                      errores={erroresParrafos(clave)}
                      alCambiar={(v) => cambiar(clave, v)}
                      lineas={lineas}
                      ayuda={lineas ? 'Lo que va entre **asteriscos** sale en negrita.' : undefined}
                    />
                  )
                })}
              </>
            )}
          </PestanasIdioma>
        </Bloque>

        <Bloque
          n="02"
          titulo="Ficha"
          cambios={cuantos((k) => !/\.(es|en)$/.test(k) && !k.startsWith('certificate_'))}
          texto={empleo ? 'Las fechas también las usa el CV.' : 'Formación: un programa largo (bootcamp, grado). Curso: algo corto.'}
        >
          {!empleo && (
            <Campo etiqueta="Tipo" {...marca('kind')}>
              <div className={`segmento${form.cambiado('kind') ? ' cambiado' : ''}`} role="group" aria-label="Tipo">
                {[
                  ['program', 'Formación'],
                  ['course', 'Curso'],
                ].map(([valor, texto]) => (
                  <button key={valor} type="button" aria-pressed={valores.kind === valor} onClick={() => cambiar('kind', valor)}>
                    {texto}
                  </button>
                ))}
              </div>
            </Campo>
          )}
          <div className="fila-campos">
            {empleo ? campoTexto('company', 'Empresa') : campoTexto('institution', 'Centro', { placeholder: 'Por mi cuenta' })}
            {campoTexto('location', 'Lugar')}
            {!empleo && campoTexto('hours', 'Horas', { tipo: 'number', min: 1, inputMode: 'numeric' })}
          </div>
          <div className="fila-campos">
            {campoTexto('start_date', 'Desde', { tipo: 'month' })}
            {campoTexto('end_date', 'Hasta', { tipo: 'month', disabled: actualmente })}
            <Campo etiqueta={tipo.ahora}>
              <label className="interruptor">
                <input
                  type="checkbox"
                  checked={actualmente}
                  aria-label={tipo.ahora}
                  onChange={(e) => cambiar('end_date', e.target.checked ? '' : esteMes())}
                />
                {actualmente ? 'Sí' : 'No'}
              </label>
            </Campo>
          </div>
          {empleo && campoTexto('tools', 'Herramientas', { ayuda: 'Opcional. Sale en pequeño debajo del puesto.' })}
          <div className="fila-campos">
            <Campo etiqueta="En la web" {...marca('is_visible')}>
              <label className="interruptor">
                <input type="checkbox" checked={valores.is_visible} aria-label="Visible en la web" onChange={(e) => cambiar('is_visible', e.target.checked)} />
                {valores.is_visible ? 'Visible' : `Ocult${tipo.o}`}
              </label>
            </Campo>
            {campoTexto('posicion', 'Posición', {
              tipo: 'number',
              min: 1,
              inputMode: 'numeric',
              placeholder: nuevo ? 'Al final' : undefined,
              ayuda: '1 es el primero en la web.',
            })}
          </div>
          {!nuevo && (
            <Campo etiqueta="Clave" id="c-clave" ayuda={`No se cambia: el CV la usa para engancharse a ${empleo ? 'este empleo' : 'esta formación'}.`}>
              <input id="c-clave" type="text" value={detalle.slug} readOnly />
            </Campo>
          )}
          {usosCv.length > 0 && (
            <div className="solo-lectura">
              Lo usa el CV en {usosCv.map((u) => `«${u}»`).join(', ')}
              <Link className="enlace" to={`${RUTA_PANEL}/cv`} style={{ marginLeft: 'auto' }}>
                Ver el CV →
              </Link>
            </div>
          )}
        </Bloque>

        {!empleo && (
          <Bloque
            n="03"
            titulo="Certificado"
            cambios={cuantos((k) => k.startsWith('certificate_'))}
            texto="El enlace de verificación es lo más fiable. El archivo (PDF o imagen) es la copia."
          >
            {campoTexto('certificate_url', 'Enlace de verificación', { tipo: 'url', placeholder: 'https://…', spellCheck: false })}
            <Campo etiqueta="Archivo" {...marca('certificate_file')}>
              <div className="solo-lectura">
                {archivo ? (
                  <>
                    {archivo.split('/').at(-1)}
                    <span className="acciones-archivo">
                      <a className="enlace" href={archivo} target="_blank" rel="noopener">
                        Ver ↗
                      </a>
                      <button className="enlace gris" type="button" onClick={() => cambiar('certificate_file', null)}>
                        Quitar
                      </button>
                    </span>
                  </>
                ) : (
                  'Sin archivo.'
                )}
                <span className="chip bor">Subirlo llega en ADM-08</span>
              </div>
            </Campo>
          </Bloque>
        )}

        {!nuevo && (
          <Bloque n={empleo ? '03' : '04'} titulo="Borrar" texto="Si solo quieres quitarlo de la web, ocúltalo.">
            {usosCv.length > 0 ? (
              <p className="ayuda nota-bloque">
                No se puede borrar: el CV lo usa en {usosCv.map((u) => `«${u}»`).join(', ')}. Quítalo del CV antes, u ocúltalo.
              </p>
            ) : (
              <div>
                <button className="boton peligro" type="button" onClick={() => setBorrar(true)}>
                  Borrar {nombreGuardado}…
                </button>
              </div>
            )}
          </Bloque>
        )}
      </form>

      <div className="barra-guardar">
        {numErrores > 0 || fallo ? (
          <p className="mal">✕ No se ha guardado: revisa lo marcado</p>
        ) : total > 0 ? (
          <p className="aviso">● {cambios(total)} sin guardar</p>
        ) : (
          <p>{detalle ? 'Todo guardado' : 'Sin guardar todavía'}</p>
        )}
        <div className="acciones">
          {!nuevo &&
            (total > 0 ? (
              <button className="boton suave" type="button" disabled title="La vista previa enseña lo guardado">
                Guarda para la vista previa
              </button>
            ) : (
              <a className="boton suave" href={`${tipo.ruta}/${id}/vista-previa`} target="_blank" rel="noopener">
                Vista previa ↗
              </a>
            ))}
          <button className="boton azul" type="button" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <AvisoSalir cuantos={total} />
      <Dialogo abierto={borrar} titulo={`Borrar ${nombreGuardado ?? ''}`} alCerrar={borrando ? undefined : () => setBorrar(false)}>
        <p>
          Desaparece de la web <b>al publicar</b>. <b>No se puede deshacer.</b> Si solo quieres quitarlo de la web, ocúltalo.
        </p>
        <div className="acciones">
          <button className="boton suave" type="button" onClick={() => setBorrar(false)} disabled={borrando} data-enfoque>
            Cancelar
          </button>
          <button className="boton peligro lleno" type="button" onClick={confirmarBorrar} disabled={borrando}>
            {borrando ? 'Borrando…' : `Borrar ${nombreGuardado ?? ''}`}
          </button>
        </div>
      </Dialogo>
    </>
  )
}
