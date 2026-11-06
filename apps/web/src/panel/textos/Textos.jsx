import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router'
import { pedir } from '@/panel/utilidades/api.js'
import AreaTexto from '@/panel/comun/AreaTexto.jsx'
import AvisoSalir from '@/panel/comun/AvisoSalir.jsx'
import { useAvisar } from '@/panel/comun/avisos.js'
import Campo, { MarcaRevisar } from '@/panel/comun/Campo.jsx'
import { Banda, Cabecera } from '@/panel/comun/Estados.jsx'
import ListaBloques from '@/panel/comun/ListaBloques.jsx'
import ListaParrafos from '@/panel/comun/ListaParrafos.jsx'
import PestanasIdioma from '@/panel/comun/PestanasIdioma.jsx'
import { useRevisarIdiomas } from '@/panel/comun/RevisarIdiomas.jsx'
import { conError, useFormulario } from '@/panel/comun/useFormulario.js'
import { cuandoSeGuardo } from '@/panel/utilidades/fechas.js'
import {
  MENSAJE_LISTA,
  MENSAJE_TEXTOS,
  RUTA_TEXTOS,
  aApi,
  aFormulario,
  clavesDeListas,
  erroresDeLista,
  mensaje,
  seccionesDe,
} from '@/panel/textos/textos.js'
import { ponerTitulo } from '@/idioma/documento.js'

const cambios = (n) => (n === 1 ? '1 cambio' : `${n} cambios`)
const idDe = (clave) => `c-${clave.replaceAll('.', '-')}`

// 7 · Textos (aprobada en ADM-00): las secciones de la web a la izquierda y sus textos, en
// español e inglés, a la derecha. Se guardan todos los cambiados a la vez, de cualquier
// sección. La sección elegida va en la dirección (?seccion=contacto).
export default function Textos() {
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const [datos, setDatos] = useState(null) // { textos, actualizado } tal como los da la API
  const [carga, setCarga] = useState('cargando')
  const [intento, setIntento] = useState(0)
  const [idioma, setIdioma] = useState('es')
  const [errores, setErrores] = useState({})
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const ventana = useRef(null)

  const secciones = useMemo(() => (datos ? seccionesDe(datos.textos) : []), [datos])
  const form = useFormulario(useMemo(() => clavesDeListas(secciones), [secciones]))
  const { valores, original, cuantos } = form
  // "Revisar" (#185): a la sección y a la pestaña del primer campo por revisar.
  const revision = useRevisarIdiomas(form, (lang, clave) => {
    setIdioma(lang)
    const s = secciones.find((x) => x.campos.some((c) => clave === c.clave || clave.startsWith(`${c.clave}.`)))
    if (s) setParams({ seccion: s.id }, { replace: true })
  })

  useEffect(() => {
    ponerTitulo('Textos · Panel')
  }, [])

  useEffect(() => {
    let vivo = true
    pedir('/texts').then((r) => {
      if (!vivo) return
      if (!r.ok) {
        setCarga(r.error === 'red' ? 'red' : 'servidor')
        return
      }
      setDatos(r.datos)
      form.cargar(aFormulario(r.datos.textos, seccionesDe(r.datos.textos)))
      setCarga('lista')
    })
    return () => {
      vivo = false
    }
    // form.cargar no cambia nunca (useCallback sin dependencias).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento])

  // La vista previa, abierta en otra pestaña, recibe lo escrito en cada cambio (sin guardar).
  const borrador = useMemo(
    () => (valores && datos ? aApi(valores, secciones, datos.textos) : null),
    [valores, datos, secciones],
  )
  const seccion = secciones.find((s) => s.id === params.get('seccion')) ?? secciones[0]
  useEffect(() => {
    const enviar = () => {
      if (!ventana.current || ventana.current.closed || !borrador) return
      ventana.current.postMessage({ tipo: MENSAJE_TEXTOS, textos: borrador, seccion: seccion?.id }, window.location.origin)
    }
    enviar()
    // La vista previa, al abrirse, pide lo escrito.
    const alMensaje = (e) => {
      if (e.origin === window.location.origin && e.source === ventana.current && e.data?.tipo === MENSAJE_LISTA) enviar()
    }
    window.addEventListener('message', alMensaje)
    return () => window.removeEventListener('message', alMensaje)
  }, [borrador, seccion?.id])

  if (carga !== 'lista') {
    return (
      <>
        <Cabecera titulo="Textos" texto="Los textos de cada sección de la web, en los dos idiomas." />
        {carga === 'cargando' ? (
          <div className="filas-cargando" aria-busy="true" aria-label="Cargando los textos">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <span className="hueco mini" />
                <span className="hueco alto" />
              </div>
            ))}
          </div>
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
            <b>No se han podido cargar los textos.</b> {carga === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
          </Banda>
        )}
      </>
    )
  }

  // --- Cambios, errores y guardar
  const deClave = (clave) => (k) => k === clave || k.startsWith(`${clave}.`)
  const deSeccion = (s) => (k) => s.campos.some((c) => deClave(c.clave)(k))
  const total = cuantos()
  const numErrores = Object.keys(errores).length

  const cambiar = (clave, valor) => {
    form.poner(clave, valor)
    setErrores((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !deClave(clave)(k))))
  }
  const deshacer = (clave) => cambiar(clave, original[clave])
  const errorDe = (clave) => (errores[clave] ? mensaje(clave, errores[clave]) : null)
  const elegir = (s) => setParams({ seccion: s.id }, { replace: true })

  const guardar = async () => {
    const claves = secciones.flatMap((s) => s.campos.map((c) => c.clave)).filter((c) => cuantos(deClave(c)) > 0)
    if (claves.length === 0) return
    setGuardando(true)
    setFallo(null)
    const r = await pedir('/texts', { method: 'PUT', body: JSON.stringify({ textos: aApi(valores, secciones, datos.textos, claves) }) })
    setGuardando(false)
    if (!r.ok) {
      if (r.error === 'validacion') {
        setErrores(r.datos.errores)
        // A la primera sección y al idioma con algo que revisar.
        const primera = Object.keys(r.datos.errores)[0]
        const seccionConError = secciones.find((s) => deSeccion(s)(primera))
        if (seccionConError) elegir(seccionConError)
        const lang = primera.split('.').find((p) => p === 'es' || p === 'en')
        if (lang) setIdioma(lang)
      } else setFallo(r.error)
      return
    }
    setErrores({})
    setDatos(r.datos)
    form.cargar(aFormulario(r.datos.textos, secciones))
    cargarResumen()
    avisar('ok', 'Guardado. Se verá en la web al publicar.')
  }

  const descartar = () => {
    form.descartar()
    setErrores({})
    setFallo(null)
  }

  const abrirVistaPrevia = () => {
    ventana.current = window.open(`${RUTA_TEXTOS}/vista-previa?seccion=${seccion.id}`, 'vista-previa-textos')
  }

  // --- Un campo, según su tipo
  const pintar = (c, lang) => {
    const clave = `${c.clave}.${lang}`
    const id = idDe(clave)
    const marca = { cambiado: form.cambiado(clave), alDeshacer: () => deshacer(clave), revisar: form.revisar(clave) }

    if (c.tipo === 'linea' || c.tipo === 'parrafo') {
      const error = errorDe(clave)
      const largo = valores[clave].length
      const etiqueta = c.maximo ? (
        <>
          {c.etiqueta}
          <small className={`contador${largo > c.maximo ? ' pasado' : ''}`}>
            {largo} / {c.maximo}
          </small>
        </>
      ) : (
        c.etiqueta
      )
      const Control = c.tipo === 'parrafo' ? AreaTexto : 'input'
      return (
        <Campo key={clave} etiqueta={etiqueta} id={id} ayuda={c.ayuda} error={error} {...marca}>
          <Control
            id={id}
            type={c.tipo === 'linea' ? 'text' : undefined}
            value={valores[clave]}
            onChange={(e) => cambiar(clave, e.target.value)}
            {...conError(id, error)}
          />
        </Campo>
      )
    }

    if (c.tipo === 'lineas' || c.tipo === 'parrafos' || c.tipo === 'pares') {
      return (
        <ListaParrafos
          key={clave}
          etiqueta={c.etiqueta}
          valor={valores[clave]}
          original={original[clave]}
          errores={erroresDeLista(errores, clave)}
          alCambiar={(v) => cambiar(clave, v)}
          lineas={c.tipo === 'lineas'}
          pares={c.pares}
          ayuda={c.ayuda}
          anadir={c.anadir}
          revisar={form.revisar(clave)}
        />
      )
    }

    if (c.tipo === 'grupos') {
      return Object.entries(c.grupos)
        .filter(([g]) => `${clave}.${g}.titulo` in valores)
        .map(([g, nombre]) => (
          <div className="fila-campos" key={`${clave}.${g}`}>
            {['titulo', 'subtitulo'].map((sub) => {
              const k = `${clave}.${g}.${sub}`
              const error = errorDe(k)
              return (
                <Campo
                  key={k}
                  etiqueta={`${nombre} · ${sub === 'titulo' ? 'título' : 'subtítulo'}`}
                  id={idDe(k)}
                  error={error}
                  cambiado={form.cambiado(k)}
                  alDeshacer={() => deshacer(k)}
                  revisar={form.revisar(k)}
                >
                  <input id={idDe(k)} type="text" value={valores[k]} onChange={(e) => cambiar(k, e.target.value)} {...conError(idDe(k), error)} />
                </Campo>
              )
            })}
          </div>
        ))
    }

    // legal: el título de la página y sus apartados.
    const kTitulo = `${clave}.titulo`
    const kBloques = `${clave}.bloques`
    const errorTitulo = errorDe(kTitulo)
    return (
      <div className="campos" key={clave}>
        <Campo
          etiqueta="Título de la página"
          id={idDe(kTitulo)}
          error={errorTitulo}
          cambiado={form.cambiado(kTitulo)}
          alDeshacer={() => deshacer(kTitulo)}
          revisar={form.revisar(kTitulo)}
        >
          <input id={idDe(kTitulo)} type="text" value={valores[kTitulo]} onChange={(e) => cambiar(kTitulo, e.target.value)} {...conError(idDe(kTitulo), errorTitulo)} />
        </Campo>
        <p className="etiqueta mono">
          Apartados
          {form.revisar(kBloques) && <MarcaRevisar idioma={form.revisar(kBloques)} />}
        </p>
        <ListaBloques
          valor={valores[kBloques]}
          original={original[kBloques]}
          alCambiar={(v) => cambiar(kBloques, v)}
          nuevo={{ titulo: '', texto: [''] }}
          nombre="Apartado"
          anadir="+ Añadir apartado"
        >
          {(bloque, i) => {
            const poner = (campo, v) => cambiar(kBloques, valores[kBloques].map((b, j) => (j === i ? { ...b, [campo]: v } : b)))
            const idT = idDe(`${kBloques}.${i}.titulo`)
            const error = errores[`${kBloques}.${i}.titulo`] ? mensaje(`${kBloques}.${i}.titulo`, errores[`${kBloques}.${i}.titulo`]) : null
            return (
              <>
                <Campo etiqueta="Título" id={idT} error={error}>
                  <input id={idT} type="text" value={bloque.titulo} onChange={(e) => poner('titulo', e.target.value)} {...conError(idT, error)} />
                </Campo>
                <ListaParrafos
                  etiqueta="Párrafos"
                  valor={bloque.texto}
                  original={original[kBloques][i]?.texto}
                  errores={erroresDeLista(errores, `${kBloques}.${i}.texto`)}
                  alCambiar={(v) => poner('texto', v)}
                  ayuda={NEGRITA_LEGAL}
                />
              </>
            )
          }}
        </ListaBloques>
      </div>
    )
  }

  const revisarEn = (lang) => form.porRevisar((k) => deSeccion(seccion)(k) && k.split('.').includes(lang)).length > 0
  const porRevisar = form.porRevisar().length
  const erroresEn = (lang) => Object.keys(errores).some((k) => deSeccion(seccion)(k) && k.split('.').includes(lang))
  const actualizado = datos.actualizado

  return (
    <>
      <Cabecera titulo="Textos" texto="Los textos de cada sección de la web, en los dos idiomas." />

      {total > 0 && (
        <Banda
          tipo="aviso"
          acciones={
            <>
              <button className="boton suave pequeno" type="button" onClick={descartar}>
                Descartar
              </button>
              <button className="boton azul pequeno" type="button" onClick={revision.comprobar(guardar)} disabled={guardando}>
                Guardar
              </button>
            </>
          }
        >
          <b>Tienes {cambios(total)} sin guardar</b>
          {' en '}
          {secciones
            .filter((s) => cuantos(deSeccion(s)) > 0)
            .map((s) => s.nombre)
            .join(', ')}
          . Están marcados en ámbar; si sales ahora, te avisaré.
          {porRevisar > 0 && ` En azul, ${porRevisar === 1 ? 'el campo' : `los ${porRevisar} campos`} que cambiaste solo en un idioma.`}
        </Banda>
      )}
      {numErrores > 0 && (
        <Banda tipo="error">
          <b>No se ha guardado:</b> {numErrores === 1 ? 'hay 1 cosa que revisar' : `hay ${numErrores} cosas que revisar`}{' '}
          en{' '}
          {secciones
            .filter((s) => Object.keys(errores).some(deSeccion(s)))
            .map((s) => s.nombre)
            .join(', ')}
          . Está marcado en rojo.
        </Banda>
      )}
      {fallo && (
        <Banda tipo="error">
          <b>No se ha guardado.</b> {fallo === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'} Lo que has
          escrito sigue aquí.
        </Banda>
      )}

      <div className="dos-col">
        <nav className="secciones subnav" aria-label="Secciones de la web">
          {secciones.map((s, i) => (
            <Link
              key={s.id}
              to={`?seccion=${s.id}`}
              replace
              aria-current={s.id === seccion.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                elegir(s)
              }}
            >
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              {s.nombre}
              {cuantos(deSeccion(s)) > 0 && <span className="punto" aria-label="con cambios sin guardar" />}
            </Link>
          ))}
        </nav>

        <form className="seccion-txt" noValidate onSubmit={(e) => e.preventDefault()}>
          <h2>{seccion.nombre}</h2>
          <p>{seccion.texto}</p>
          <PestanasIdioma
            actual={idioma}
            alCambiar={setIdioma}
            conCambios={{
              es: cuantos((k) => deSeccion(seccion)(k) && k.split('.').includes('es')) > 0,
              en: cuantos((k) => deSeccion(seccion)(k) && k.split('.').includes('en')) > 0,
            }}
            conErrores={{ es: erroresEn('es'), en: erroresEn('en') }}
            conRevisar={{ es: revisarEn('es'), en: revisarEn('en') }}
          >
            {(lang) => seccion.campos.map((c) => pintar(c, lang))}
          </PestanasIdioma>
        </form>
      </div>

      <div className="barra-guardar">
        {numErrores > 0 || fallo ? (
          <p className="mal">✕ No se ha guardado: revisa lo marcado</p>
        ) : total > 0 ? (
          <p className="aviso">● {cambios(total)} sin guardar</p>
        ) : (
          <p>{actualizado ? `Guardado ${cuandoSeGuardo(actualizado)}` : 'Sin cambios'}</p>
        )}
        <div className="acciones">
          <button className="boton suave" type="button" onClick={abrirVistaPrevia}>
            Vista previa ↗
          </button>
          <button className="boton azul" type="button" onClick={revision.comprobar(guardar)} disabled={guardando || total === 0}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <AvisoSalir cuantos={total} />
      {revision.dialogo}
    </>
  )
}

const NEGRITA_LEGAL = 'Lo que va entre **asteriscos** sale en negrita.'
