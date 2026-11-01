import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router'
import { pedir } from '@/admin/api.js'
import AvisoSalir from '@/admin/comun/AvisoSalir.jsx'
import { useAvisar } from '@/admin/comun/avisos.js'
import Campo from '@/admin/comun/Campo.jsx'
import { Banda, Cabecera } from '@/admin/comun/Estados.jsx'
import ListaParrafos from '@/admin/comun/ListaParrafos.jsx'
import PestanasIdioma from '@/admin/comun/PestanasIdioma.jsx'
import SelectorTecnologias from '@/admin/comun/SelectorTecnologias.jsx'
import { conError, useFormulario } from '@/admin/comun/useFormulario.js'
import { cuandoSeGuardo, elDiaALas } from '@/admin/fechas.js'
import { NoEncontrado } from '@/admin/Proximamente.jsx'
import { BLOQUES, CLAVES_PARRAFOS, PARRAFOS, TEXTOS, aApi, aFormulario, mensaje, rutaProyecto } from '@/admin/proyectos/campos.js'
import DialogoBorrar from '@/admin/proyectos/DialogoBorrar.jsx'
import { RUTA_PANEL } from '@/admin/ruta.js'
import { FORMATO_SLUG, aSlug } from '@/admin/slug.js'
import { ponerTitulo } from '@/i18n/documento.js'

const ESPERA_SLUG = 400 // ms sin escribir antes de preguntar si la dirección está libre
const LISTA = `${RUTA_PANEL}/proyectos`

const cambios = (n) => (n === 1 ? '1 cambio' : `${n} cambios`)

// 5 · Proyecto · edición (aprobada en ADM-00). Crear y editar son la misma pantalla.
// Cada dirección es un formulario nuevo (key): de "nuevo" a "12" al guardar, se empieza limpio.
export default function Proyecto() {
  const { id } = useParams()
  if (id !== undefined && !/^\d+$/.test(id)) return <NoEncontrado />
  return <Formulario key={id ?? 'nuevo'} id={id} />
}

function Formulario({ id }) {
  const nuevo = id === undefined
  const navigate = useNavigate()
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const form = useFormulario(CLAVES_PARRAFOS)
  const { valores, original, poner, cuantos } = form

  const [carga, setCarga] = useState('cargando') // 'cargando' | 'lista' | 'no_existe' | 'red' | 'servidor'
  const [intento, setIntento] = useState(0)
  const [todas, setTodas] = useState([])
  const [detalle, setDetalle] = useState(null) // lo guardado, tal como lo da la API
  const [idioma, setIdioma] = useState('es')
  const [errores, setErrores] = useState({})
  const [slugDe, setSlugDe] = useState(null)
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [slugTocado, setSlugTocado] = useState(!nuevo)
  const [comprobacion, setComprobacion] = useState(null) // { slug, libre, de }
  const [borrar, setBorrar] = useState(false)
  const [irA, setIrA] = useState(null)

  useEffect(() => {
    let vivo = true
    const proyecto = nuevo ? Promise.resolve({ ok: true, datos: null }) : pedir(`/projects/${id}`)
    Promise.all([pedir('/technologies'), proyecto]).then(([t, p]) => {
      if (!vivo) return
      const falla = [p, t].find((r) => !r.ok)
      if (falla) {
        setCarga(falla.error === 'no_existe' || falla.error === 'red' ? falla.error : 'servidor')
        return
      }
      setTodas(t.datos)
      setDetalle(p.datos)
      form.cargar(aFormulario(p.datos ?? {}))
      setCarga('lista')
    })
    return () => {
      vivo = false
    }
    // form.cargar no cambia nunca (useCallback sin dependencias).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nuevo, intento])

  const nombreGuardado = detalle?.name?.es || detalle?.slug
  useEffect(() => {
    ponerTitulo(`${nombreGuardado ?? 'Nuevo proyecto'} · Panel`)
  }, [nombreGuardado])

  // Navegar después de pintar: así el aviso de salir ya sabe que no quedan cambios.
  useEffect(() => {
    if (irA) navigate(irA, { replace: true })
  }, [irA, navigate])

  // ¿Está libre la dirección? Se pregunta al dejar de escribir, antes de guardar.
  const slug = valores?.slug ?? ''
  useEffect(() => {
    if (!slug || !FORMATO_SLUG.test(slug) || slug === detalle?.slug) return undefined
    const espera = setTimeout(() => {
      const excepto = nuevo ? '' : `&excepto=${id}`
      pedir(`/projects/slug?valor=${encodeURIComponent(slug)}${excepto}`).then((r) => {
        if (r.ok) setComprobacion({ slug, ...r.datos })
      })
    }, ESPERA_SLUG)
    return () => clearTimeout(espera)
  }, [slug, detalle?.slug, id, nuevo])

  if (carga === 'no_existe') return <NoEncontrado />

  const volver = (
    <Link className="volver" to={LISTA}>
      ← Proyectos
    </Link>
  )

  if (carga !== 'lista') {
    return (
      <>
        {volver}
        <Cabecera titulo={nuevo ? 'Nuevo proyecto' : 'Proyecto'} />
        {carga === 'cargando' ? (
          <Esqueleto />
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
            <b>No se ha podido abrir el proyecto.</b> {carga === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
          </Banda>
        )}
      </>
    )
  }

  // --- Cambiar un campo: su error de la API se quita (ya no es lo que se envió).
  const cambiar = (clave, valor) => {
    poner(clave, valor)
    setErrores((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== clave && !k.startsWith(`${clave}.`))))
    if (clave === 'name.es' && !slugTocado) poner('slug', aSlug(valor))
  }

  // Deshacer es volver a escribir lo guardado: también quita el error de ese campo.
  const deshacer = (clave) => cambiar(clave, original[clave])

  // El error de un campo: el de la API o, en la dirección, el de la comprobación al escribir.
  const errorDe = (clave) => {
    if (errores[clave]) return mensaje(clave, errores[clave], { de: slugDe })
    if (clave !== 'slug' || !slug) return null
    if (!FORMATO_SLUG.test(slug)) return mensaje('slug', 'formato')
    if (comprobacion?.slug === slug && !comprobacion.libre) return mensaje('slug', 'existe', { de: comprobacion.de })
    return null
  }

  const total = cuantos()
  const numErrores = Object.keys(errores).length
  const erroresEn = (lang) => Object.keys(errores).some((k) => k.split('.')[1] === lang)

  const guardar = async () => {
    setGuardando(true)
    setFallo(null)
    const r = await pedir(nuevo ? '/projects' : `/projects/${id}`, {
      method: nuevo ? 'POST' : 'PUT',
      body: JSON.stringify(aApi(valores)),
    })
    setGuardando(false)
    if (!r.ok) {
      if (r.error === 'validacion') {
        setErrores(r.datos.errores)
        setSlugDe(r.datos.slug_de ?? null)
        // Si lo que falla está solo en el otro idioma, se abre esa pestaña.
        const langs = ['es', 'en'].filter((l) => Object.keys(r.datos.errores).some((k) => k.split('.')[1] === l))
        if (langs.length && !langs.includes(idioma)) setIdioma(langs[0])
      } else setFallo(r.error)
      return
    }
    setErrores({})
    setDetalle(r.datos)
    form.cargar(aFormulario(r.datos))
    setSlugTocado(true)
    cargarResumen()
    avisar(
      'ok',
      r.datos.status === 'published' ? 'Guardado. Se verá en la web al publicar.' : 'Guardado como borrador: no sale en la web.',
    )
    if (nuevo) setIrA(rutaProyecto(r.datos.id))
  }

  const descartar = () => {
    form.descartar()
    setErrores({})
    setFallo(null)
  }

  // --- Piezas que se repiten
  const campoTexto = (clave, { etiqueta, ayuda, largo, tipo = 'text', ...resto }) => {
    const idCampo = `c-${clave.replace('.', '-')}`
    const error = errorDe(clave)
    const Control = largo ? 'textarea' : 'input'
    return (
      <Campo
        key={clave}
        etiqueta={etiqueta}
        id={idCampo}
        ayuda={ayuda}
        error={error}
        cambiado={form.cambiado(clave)}
        alDeshacer={() => deshacer(clave)}
      >
        <Control
          id={idCampo}
          type={largo ? undefined : tipo}
          rows={largo ? 3 : undefined}
          value={valores[clave]}
          onChange={(e) => cambiar(clave, e.target.value)}
          {...conError(idCampo, error)}
          {...resto}
        />
      </Campo>
    )
  }

  const interruptor = (clave, etiqueta, texto) => (
    <Campo etiqueta={etiqueta} cambiado={form.cambiado(clave)} alDeshacer={() => deshacer(clave)}>
      <label className="interruptor">
        <input type="checkbox" checked={valores[clave]} aria-label={etiqueta} onChange={(e) => cambiar(clave, e.target.checked)} />
        {texto}
      </label>
    </Campo>
  )

  const erroresParrafos = (clave) =>
    Object.fromEntries(
      Object.entries(errores)
        .filter(([k]) => k.startsWith(`${clave}.`))
        .map(([k, codigo]) => [k.split('.')[2], mensaje(k, codigo)]),
    )

  const publicado = valores.status === 'published'
  const titulo = nombreGuardado ?? 'Nuevo proyecto'

  return (
    <>
      {volver}
      <Cabecera
        titulo={titulo}
        texto={
          nuevo
            ? 'Todavía sin guardar. Nacerá como borrador, al final de la lista.'
            : `/proyectos/${detalle.slug} · guardado por última vez ${elDiaALas(detalle.updated_at)}`
        }
      >
        <div className={`segmento${form.cambiado('status') ? ' cambiado' : ''}`} role="group" aria-label="Estado">
          <button type="button" aria-pressed={!publicado} onClick={() => cambiar('status', 'draft')}>
            Borrador
          </button>
          <button type="button" aria-pressed={publicado} onClick={() => cambiar('status', 'published')}>
            Publicado
          </button>
        </div>
      </Cabecera>

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
          <b>No se ha guardado.</b>{' '}
          {numErrores === 1 ? 'Hay 1 cosa que revisar' : `Hay ${numErrores} cosas que revisar`}: está marcado en rojo
          {['es', 'en'].filter(erroresEn).length > 0 && ', y la pestaña del idioma dice «falta»'}.
          {publicado && ' Un borrador se puede guardar a medias; para publicarlo, tiene que estar completo.'}
        </Banda>
      )}
      {fallo && (
        <Banda tipo="error">
          <b>No se ha guardado.</b>{' '}
          {fallo === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'} Lo que has escrito sigue aquí.
        </Banda>
      )}

      <form className="form" noValidate onSubmit={(e) => e.preventDefault()}>
        <Bloque
          n="01"
          titulo="Textos"
          cambios={cuantos(BLOQUES.textos)}
          texto="Lo que se lee en la tarjeta y en la página del proyecto. Lo marcado con **asteriscos** sale en negrita."
        >
          <PestanasIdioma
            actual={idioma}
            alCambiar={setIdioma}
            conCambios={{ es: cuantos((k) => k.endsWith('.es')) > 0, en: cuantos((k) => k.endsWith('.en')) > 0 }}
            conErrores={{ es: erroresEn('es'), en: erroresEn('en') }}
          >
            {(lang) => (
              <>
                {TEXTOS.map(({ campo, ...resto }) => campoTexto(`${campo}.${lang}`, resto))}
                {PARRAFOS.map(({ campo, etiqueta }) => {
                  const clave = `${campo}.${lang}`
                  return (
                    <ListaParrafos
                      key={clave}
                      etiqueta={etiqueta}
                      valor={valores[clave]}
                      original={original[clave]}
                      errores={erroresParrafos(clave)}
                      alCambiar={(v) => cambiar(clave, v)}
                    />
                  )
                })}
              </>
            )}
          </PestanasIdioma>
        </Bloque>

        <Bloque n="02" titulo="Ficha" cambios={cuantos(BLOQUES.ficha)} texto="Datos que no se traducen.">
          <Campo
            etiqueta="Dirección"
            id="c-slug"
            error={errorDe('slug')}
            cambiado={form.cambiado('slug')}
            alDeshacer={() => deshacer('slug')}
            ayuda={
              <>
                mateorodriguez.solutions/proyectos/<b>{slug || '…'}</b>
                {!nuevo && '. Si la cambias, los enlaces antiguos dejarán de funcionar; el CV se cambia solo.'}
              </>
            }
          >
            <div className="con-boton">
              <input
                id="c-slug"
                type="text"
                value={slug}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setSlugTocado(true)
                  cambiar('slug', e.target.value)
                }}
                {...conError('c-slug', errorDe('slug'))}
              />
              <button
                type="button"
                onClick={() => {
                  setSlugTocado(!nuevo)
                  cambiar('slug', aSlug(valores['name.es']))
                }}
              >
                Desde el nombre
              </button>
            </div>
          </Campo>
          <div className="fila-campos">
            {campoTexto('posicion', {
              etiqueta: 'Posición',
              tipo: 'number',
              min: 1,
              inputMode: 'numeric',
              placeholder: nuevo ? 'Al final' : undefined,
              ayuda: '1 es el primero en la web. Los demás se corren solos.',
            })}
            {interruptor('is_featured', 'Destacado', 'En la portada')}
          </div>
          <div className="fila-campos">
            {interruptor('is_team_project', 'En equipo', 'Sí')}
            {valores.is_team_project && (
              <>
                {campoTexto('team_size', { etiqueta: 'Personas', tipo: 'number', min: 2, inputMode: 'numeric' })}
                {campoTexto('commits_share', { etiqueta: 'Mis commits (%)', tipo: 'number', min: 0, max: 100, inputMode: 'numeric' })}
              </>
            )}
          </div>
        </Bloque>

        <Bloque
          n="03"
          titulo="Enlaces"
          cambios={cuantos(BLOQUES.enlaces)}
          texto="La demo y el código. Si uno queda vacío, su botón no sale en la web."
        >
          {campoTexto('demo_url', { etiqueta: 'Demo', tipo: 'url', placeholder: 'https://…', spellCheck: false })}
          {campoTexto('repo_url', { etiqueta: 'Repositorio', tipo: 'url', placeholder: 'https://github.com/…', spellCheck: false })}
        </Bloque>

        <Bloque
          n="04"
          titulo="Tecnologías"
          cambios={cuantos(BLOQUES.tecnologias)}
          texto="De la lista de Conocimientos. Si falta una, añádela allí primero."
        >
          <Campo
            etiqueta="Tecnologías · en este orden"
            id="c-tecnologias"
            error={errorDe('technologies')}
            cambiado={form.cambiado('technologies')}
            alDeshacer={() => deshacer('technologies')}
          >
            <SelectorTecnologias
              id="c-tecnologias"
              todas={todas}
              valor={valores.technologies}
              alCambiar={(v) => cambiar('technologies', v)}
            />
          </Campo>
        </Bloque>

        <Bloque n="05" titulo="Imágenes" texto="La primera es la portada en la tarjeta y en la página.">
          <div className="solo-lectura">
            {detalle?.imagenes
              ? `${detalle.imagenes === 1 ? '1 imagen' : `${detalle.imagenes} imágenes`}.`
              : 'Sin imágenes todavía: en la web se ve el hueco con la cámara.'}
            <span className="chip bor">Subirlas llega en ADM-08</span>
          </div>
        </Bloque>

        {!nuevo && (
          <Bloque n="06" titulo="Borrar" texto="Si solo quieres quitarlo de la web, márcalo como borrador arriba.">
            <div>
              <button className="boton peligro" type="button" onClick={() => setBorrar(true)}>
                Borrar {nombreGuardado}…
              </button>
            </div>
          </Bloque>
        )}
      </form>

      <div className="barra-guardar">
        {numErrores > 0 || fallo ? (
          <p className="mal">✕ No se ha guardado: revisa lo marcado</p>
        ) : total > 0 ? (
          <p className="aviso">● {cambios(total)} sin guardar</p>
        ) : (
          <p>{detalle ? `Guardado ${cuandoSeGuardo(detalle.updated_at)}` : 'Sin guardar todavía'}</p>
        )}
        <div className="acciones">
          {!nuevo &&
            (total > 0 ? (
              <button className="boton suave" type="button" disabled title="La vista previa enseña lo guardado">
                Guarda para la vista previa
              </button>
            ) : (
              <a className="boton suave" href={`${rutaProyecto(id)}/vista-previa`} target="_blank" rel="noopener">
                Vista previa ↗
              </a>
            ))}
          <button className="boton azul" type="button" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <AvisoSalir cuantos={total} />
      <DialogoBorrar
        proyecto={borrar ? { id: Number(id), slug: detalle.slug, name: detalle.name } : null}
        alCerrar={() => setBorrar(false)}
        alBorrar={() => {
          descartar()
          cargarResumen()
          setIrA(LISTA)
        }}
      />
    </>
  )
}

function Bloque({ n, titulo, texto, cambios: cuantosCambios = 0, children }) {
  return (
    <section className="bloque">
      <header>
        <h2>
          <b>{n}</b>
          {titulo}
          {cuantosCambios > 0 && <span className="cuenta-cambios">{cambios(cuantosCambios)}</span>}
        </h2>
        {texto && <p>{texto}</p>}
      </header>
      <div className="campos">{children}</div>
    </section>
  )
}

function Esqueleto() {
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Cargando el proyecto">
      {Array.from({ length: 3 }, (_, i) => (
        <section className="bloque" key={i}>
          <header>
            <span className="hueco grande" />
            <span className="hueco corto" />
          </header>
          <div className="campos">
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j}>
                <span className="hueco mini" />
                <span className="hueco alto" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
