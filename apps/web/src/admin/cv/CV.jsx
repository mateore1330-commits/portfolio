import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router'
import { pedir, urlPanel } from '@/admin/api.js'
import AreaTexto from '@/admin/comun/AreaTexto.jsx'
import AvisoSalir from '@/admin/comun/AvisoSalir.jsx'
import { useAvisar } from '@/admin/comun/avisos.js'
import Bloque, { Esqueleto } from '@/admin/comun/Bloque.jsx'
import Campo from '@/admin/comun/Campo.jsx'
import { Banda, Cabecera } from '@/admin/comun/Estados.jsx'
import FichasLibres from '@/admin/comun/FichasLibres.jsx'
import ListaBloques from '@/admin/comun/ListaBloques.jsx'
import ListaParrafos from '@/admin/comun/ListaParrafos.jsx'
import PestanasIdioma from '@/admin/comun/PestanasIdioma.jsx'
import SelectorTecnologias from '@/admin/comun/SelectorTecnologias.jsx'
import { conError, parrafosCambiados, useFormulario } from '@/admin/comun/useFormulario.js'
import { cuandoSeGuardo, elDiaALas } from '@/admin/fechas.js'
import { erroresDeLista, mensaje } from '@/admin/textos/textos.js'
import { ponerTitulo } from '@/i18n/documento.js'

const IDIOMAS = ['es', 'en']
const CABECERA = [
  { campo: 'nombre', etiqueta: 'Nombre' },
  { campo: 'rol', etiqueta: 'Rol' },
  { campo: 'ubicacion', etiqueta: 'Ubicación' },
]
const BLOQUES = ['proyectos', 'experiencia', 'educacion', 'habilidades']
const NUEVOS = {
  proyectos: { titulo: '', proyecto: '', desde: '', hasta: '', lugar: '', descripcion: '', puntos: [''] },
  experiencia: { puesto: '', empresa: '', lugar: '', empleos: [], descripcion: '', puntos: [''] },
  educacion: { titulo: '', centro: '', lugar: '', formacion: '' },
  habilidades: { grupo: '', lista: [] },
}
// Los PDF publicados ahora mismo en la web (los genera seed/generar_cv.py).
const PDF = (lang) => `/cv/CV-Mateo-Rodriguez-Escobar-${lang.toUpperCase()}.pdf`

const cambios = (n) => (n === 1 ? '1 cambio' : `${n} cambios`)
const mes = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null)
// Las fechas que pondrá el generador: el primer inicio y el último fin (sin fin, "actualidad").
function fechasDe(filas) {
  if (filas.length === 0 || filas.some((f) => !f.desde)) return null
  const inicio = filas.map((f) => f.desde).sort()[0]
  const fin = filas.some((f) => !f.hasta) ? 'actualidad' : mes(filas.map((f) => f.hasta).sort().at(-1))
  return `${mes(inicio)} - ${fin}`
}

const aFormulario = (cv) =>
  Object.fromEntries(IDIOMAS.flatMap((l) => Object.entries(cv[l]).map(([campo, v]) => [`${l}.${campo}`, v])))
const aApi = (f) =>
  Object.fromEntries(
    IDIOMAS.map((l) => [
      l,
      Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith(`${l}.`)).map(([k, v]) => [k.slice(3), v])),
    ]),
  )

// 8 · CV (aprobada en ADM-00): los textos del CV en los dos idiomas. Lo que no se traduce
// (a qué está enganchado cada bloque, las fechas de los proyectos y cuántos bloques hay) es
// compartido: cambiarlo en una pestaña lo cambia en la otra (decidido en ADM-04).
export default function CV() {
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const form = useFormulario(IDIOMAS.flatMap((l) => BLOQUES.map((b) => `${l}.${b}`)))
  const { valores, original } = form
  const [opciones, setOpciones] = useState(null)
  const [actualizado, setActualizado] = useState(null)
  const [carga, setCarga] = useState('cargando')
  const [intento, setIntento] = useState(0)
  const [idioma, setIdioma] = useState('es')
  const [errores, setErrores] = useState({})
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [prueba, setPrueba] = useState({ estado: 'nada' }) // nada | generando | hecha | error

  useEffect(() => {
    ponerTitulo('CV · Panel')
  }, [])

  // El último PDF de prueba, si lo hay: se enseña su resultado al entrar.
  useEffect(() => {
    let vivo = true
    pedir('/cv/pdf').then((r) => {
      if (!vivo || !r.ok || !r.datos.prueba.es) return
      const { es, en } = r.datos.prueba
      setPrueba({ estado: 'hecha', datos: { ok: !es.problemas.length && !en?.problemas.length, prueba: r.datos.prueba } })
    })
    return () => {
      vivo = false
    }
  }, [])

  // "Generar PDF" (decidido en ADM-05): una prueba, sin publicarla. El PDF de la web se
  // genera al publicar.
  const generarPrueba = async () => {
    setPrueba({ estado: 'generando' })
    const r = await pedir('/cv/prueba', { method: 'POST' })
    if (r.ok) setPrueba({ estado: 'hecha', datos: r.datos })
    else setPrueba({ estado: 'error', detalle: r.datos?.detalle ?? (r.error === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.') })
  }

  useEffect(() => {
    let vivo = true
    pedir('/cv').then((r) => {
      if (!vivo) return
      if (!r.ok) {
        setCarga(r.error === 'red' ? 'red' : 'servidor')
        return
      }
      setOpciones(r.datos.opciones)
      setActualizado(r.datos.actualizado)
      form.cargar(aFormulario(r.datos.cv))
      setCarga('lista')
    })
    return () => {
      vivo = false
    }
    // form.cargar no cambia nunca (useCallback sin dependencias).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento])

  const cabecera = (total = 0) => (
    <Cabecera
      titulo="CV"
      texto={
        <>
          Tus textos del CV, resumidos y adaptados a las ofertas. <b>Las fechas no se escriben aquí:</b> salen de tus empleos
          y formación. El PDF de la web se genera al publicar.
        </>
      }
    >
      {IDIOMAS.map((l) => (
        <a key={l} className="boton suave" href={PDF(l)} target="_blank" rel="noopener" title="El PDF publicado en la web">
          PDF · {l.toUpperCase()} ↓
        </a>
      ))}
      <button
        className="boton azul"
        type="button"
        onClick={generarPrueba}
        disabled={prueba.estado === 'generando' || total > 0 || carga !== 'lista'}
        title={total > 0 ? 'Guarda antes de generar el PDF' : 'Genera el PDF y lo prueba, sin publicarlo'}
      >
        {prueba.estado === 'generando' ? 'Generando…' : 'Generar PDF'}
      </button>
    </Cabecera>
  )

  const bandaPrueba = () => {
    if (prueba.estado === 'generando') {
      return (
        <Banda tipo="info">
          <b>Generando el PDF…</b> Español e inglés, con la prueba ATS. Tarda unos 10 segundos.
        </Banda>
      )
    }
    if (prueba.estado === 'error') {
      return (
        <Banda tipo="error">
          <b>No se ha podido generar el PDF.</b> {prueba.detalle}
        </Banda>
      )
    }
    if (prueba.estado !== 'hecha') return null
    const { ok, detalle, prueba: pdfs } = prueba.datos
    const enlaces = IDIOMAS.filter((l) => pdfs[l]).map((l) => (
      <a key={l} className="enlace" href={urlPanel(`/cv/prueba/${l}.pdf`)} target="_blank" rel="noopener">
        Ver la prueba · {l.toUpperCase()} ↗
      </a>
    ))
    const tamanos = IDIOMAS.filter((l) => pdfs[l])
      .map((l) => `${l.toUpperCase()} ${Math.round(pdfs[l].tamano / 1024)} KB`)
      .join(' · ')
    return ok ? (
      <Banda tipo="ok" acciones={enlaces}>
        ✓ <b>Prueba generada {elDiaALas(pdfs.es.fecha)}.</b> Prueba ATS superada · {tamanos} · {pdfs.es.paginas === 1 ? '1 página' : `${pdfs.es.paginas} páginas`}.
        Al publicar se generará el de la web.
      </Banda>
    ) : (
      <Banda tipo="error" acciones={enlaces}>
        <b>No pasa la prueba ATS.</b>{' '}
        {detalle ?? IDIOMAS.flatMap((l) => pdfs[l]?.problemas ?? []).join('; ')}. Recorta el perfil o quita algún punto. Es solo una
        prueba: <b>el PDF publicado no cambia.</b>
      </Banda>
    )
  }

  if (carga !== 'lista') {
    return (
      <>
        {cabecera()}
        {carga === 'cargando' ? (
          <Esqueleto etiqueta="Cargando el CV" />
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
            <b>No se ha podido cargar el CV.</b> {carga === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
          </Banda>
        )}
      </>
    )
  }

  // --- Cambios: lo compartido cuenta una vez, aunque cambie en los dos idiomas.
  const cambiosDe = (bloque) => {
    const es = parrafosCambiados(valores[`es.${bloque}`], original[`es.${bloque}`])
    const en = parrafosCambiados(valores[`en.${bloque}`], original[`en.${bloque}`])
    return es.filter((c, i) => c || en[i]).length
  }
  const cambiosCabecera = form.cuantos((k) => !BLOQUES.some((b) => k.endsWith(`.${b}`)))
  const total = cambiosCabecera + BLOQUES.reduce((n, b) => n + cambiosDe(b), 0)
  const numErrores = Object.keys(errores).length

  const limpiarErrores = (prefijo) =>
    setErrores((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== prefijo && !k.startsWith(`${prefijo}.`))))
  const errorDe = (ruta) => (errores[ruta] ? mensaje(ruta, errores[ruta]) : null)

  const ponerTexto = (clave, v) => {
    form.poner(clave, v)
    limpiarErrores(clave)
  }
  // Un campo de un bloque en un idioma.
  const ponerEn = (lang, bloque, i, campo, v) => {
    form.poner(`${lang}.${bloque}`, valores[`${lang}.${bloque}`].map((b, j) => (j === i ? { ...b, [campo]: v } : b)))
    limpiarErrores(`${lang}.${bloque}.${i}.${campo}`)
    limpiarErrores(`${bloque}`)
  }
  // Lo compartido, en los dos idiomas a la vez.
  const ponerCompartido = (bloque, i, campo, v) => {
    for (const l of IDIOMAS) form.poner(`${l}.${bloque}`, valores[`${l}.${bloque}`].map((b, j) => (j === i ? { ...b, [campo]: v } : b)))
    limpiarErrores(`${bloque}.${i}.${campo}`)
  }
  const anadir = (bloque) => {
    for (const l of IDIOMAS) form.poner(`${l}.${bloque}`, [...valores[`${l}.${bloque}`], structuredClone(NUEVOS[bloque])])
  }
  const quitar = (bloque, i) => {
    for (const l of IDIOMAS) form.poner(`${l}.${bloque}`, valores[`${l}.${bloque}`].filter((_, j) => j !== i))
    setErrores({})
  }
  // Arrastrar un bloque lo mueve en los dos idiomas: el CV en inglés sigue al español.
  const mover = (bloque, permutar) => {
    for (const l of IDIOMAS) form.poner(`${l}.${bloque}`, permutar(valores[`${l}.${bloque}`]))
    setErrores({})
  }

  const guardar = async () => {
    setGuardando(true)
    setFallo(null)
    const r = await pedir('/cv', { method: 'PUT', body: JSON.stringify({ cv: aApi(valores) }) })
    setGuardando(false)
    if (!r.ok) {
      if (r.error === 'validacion') {
        // Las rutas de la API empiezan por "cv.": aquí no hace falta.
        const errs = Object.fromEntries(Object.entries(r.datos.errores).map(([k, v]) => [k.replace(/^cv\./, ''), v]))
        setErrores(errs)
        const lang = Object.keys(errs)
          .map((k) => k.split('.')[0])
          .find((p) => p === 'es' || p === 'en')
        if (lang && !Object.keys(errs).some((k) => k.startsWith(`${idioma}.`))) setIdioma(lang)
      } else setFallo(r.error)
      return
    }
    setErrores({})
    setActualizado(r.datos.actualizado)
    form.cargar(aFormulario(r.datos.cv))
    cargarResumen()
    avisar('ok', 'Guardado. El PDF nuevo se genera al publicar.')
  }

  const descartar = () => {
    form.descartar()
    setErrores({})
    setFallo(null)
  }

  // --- Campos que se repiten
  const campoTexto = (lang, campo, etiqueta, { largo, contador } = {}) => {
    const clave = `${lang}.${campo}`
    const id = `cv-${lang}-${campo}`
    const error = errorDe(clave)
    const Control = largo ? AreaTexto : 'input'
    const nombre = contador ? (
      <>
        {etiqueta}
        <small className="contador">{valores[clave].length} caracteres</small>
      </>
    ) : (
      etiqueta
    )
    return (
      <Campo key={clave} etiqueta={nombre} id={id} error={error} cambiado={form.cambiado(clave)} alDeshacer={() => ponerTexto(clave, original[clave])}>
        <Control id={id} type={largo ? undefined : 'text'} value={valores[clave]} onChange={(e) => ponerTexto(clave, e.target.value)} {...conError(id, error)} />
      </Campo>
    )
  }

  // Un campo de un bloque. compartido: el mismo en los dos idiomas.
  const campoBloque = (lang, bloque, i, campo, etiqueta, { compartido, largo, control } = {}) => {
    const id = `cv-${lang}-${bloque}-${i}-${campo}`
    const ruta = compartido ? `${bloque}.${i}.${campo}` : `${lang}.${bloque}.${i}.${campo}`
    const error = errorDe(ruta)
    const actual = valores[`${lang}.${bloque}`][i][campo]
    const antes = original[`${lang}.${bloque}`][i]?.[campo]
    const cambiado = antes !== undefined && JSON.stringify(actual) !== JSON.stringify(antes)
    const poner = (v) => (compartido ? ponerCompartido(bloque, i, campo, v) : ponerEn(lang, bloque, i, campo, v))
    const Control = largo ? AreaTexto : 'input'
    return (
      <Campo key={campo} etiqueta={etiqueta} id={id} error={error} cambiado={cambiado} alDeshacer={() => poner(antes)}>
        {control ? (
          control({ id, valor: actual, poner, error })
        ) : (
          <Control id={id} type={largo ? undefined : 'text'} value={actual} onChange={(e) => poner(e.target.value)} {...conError(id, error)} />
        )}
      </Campo>
    )
  }

  const puntos = (lang, bloque, i) => (
    <ListaParrafos
      etiqueta="Puntos"
      valor={valores[`${lang}.${bloque}`][i].puntos}
      original={original[`${lang}.${bloque}`][i]?.puntos}
      errores={erroresDeLista(errores, `${lang}.${bloque}.${i}.puntos`)}
      alCambiar={(v) => ponerEn(lang, bloque, i, 'puntos', v)}
      ayuda="Lo que va entre **asteriscos** sale en negrita."
    />
  )

  const mesInput = ({ id, valor, poner, error }) => (
    <input id={id} type="month" value={valor ? valor.slice(0, 7) : ''} onChange={(e) => poner(e.target.value ? `${e.target.value}-01` : '')} {...conError(id, error)} />
  )

  const empleos = opciones.empleos.map((e) => ({
    id: e.slug,
    name: `${e.empresa} · ${e.puesto}`,
    category: fechasDe([e]) ?? 'sin fechas',
  }))

  const lista = (lang, bloque, nombre, textoAnadir, children) => (
    <ListaBloques
      valor={valores[`${lang}.${bloque}`]}
      original={original[`${lang}.${bloque}`]}
      nombre={nombre}
      anadir={textoAnadir}
      alQuitar={(i) => quitar(bloque, i)}
      alAnadir={() => anadir(bloque)}
      alMover={(permutar) => mover(bloque, permutar)}
    >
      {children}
    </ListaBloques>
  )

  const erroresEn = (lang) => Object.keys(errores).some((k) => k.startsWith(`${lang}.`))

  return (
    <>
      {cabecera(total)}
      {bandaPrueba()}

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
          <b>Tienes {cambios(total)} sin guardar</b>. Están marcados en ámbar; guarda antes de generar el PDF.
        </Banda>
      )}
      {numErrores > 0 && (
        <Banda tipo="error">
          <b>No se ha guardado.</b> {numErrores === 1 ? 'Hay 1 cosa que revisar' : `Hay ${numErrores} cosas que revisar`}: está
          marcado en rojo
          {(erroresEn('es') || erroresEn('en')) && ', y la pestaña del idioma dice «falta»'}.
        </Banda>
      )}
      {fallo && (
        <Banda tipo="error">
          <b>No se ha guardado.</b> {fallo === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'} Lo que has
          escrito sigue aquí.
        </Banda>
      )}

      <form className="form" noValidate onSubmit={(e) => e.preventDefault()}>
        <PestanasIdioma
          actual={idioma}
          alCambiar={setIdioma}
          conCambios={{ es: form.cuantos((k) => k.startsWith('es.')) > 0, en: form.cuantos((k) => k.startsWith('en.')) > 0 }}
          conErrores={{ es: erroresEn('es'), en: erroresEn('en') }}
        >
          {(lang) => (
            <>
              <Bloque
                n="01"
                titulo="Cabecera"
                cambios={form.cuantos((k) => k.startsWith(`${lang}.`) && CABECERA.some((c) => k.endsWith(`.${c.campo}`)))}
                texto="Tu nombre, el rol y dónde estás. El correo y los enlaces salen de Conocimientos y enlaces."
              >
                <div className="fila-campos">{CABECERA.map((c) => campoTexto(lang, c.campo, c.etiqueta))}</div>
              </Bloque>

              <Bloque
                n="02"
                titulo="Perfil"
                cambios={form.cambiado(`${lang}.perfil`) ? 1 : 0}
                texto="El primer párrafo. Pon aquí las palabras clave de las ofertas."
              >
                {campoTexto(lang, 'perfil', 'Perfil', { largo: true, contador: true })}
              </Bloque>

              <Bloque n="03" titulo="Proyectos" cambios={cambiosDe('proyectos')} texto="El generador los ordena: lo más reciente arriba.">
                {lista(lang, 'proyectos', 'Proyecto', '+ Añadir proyecto', (p, i) => (
                  <>
                    <div className="fila-campos">
                      {campoBloque(lang, 'proyectos', i, 'titulo', 'Título')}
                      {campoBloque(lang, 'proyectos', i, 'lugar', 'Lugar')}
                    </div>
                    <div className="fila-campos">
                      {campoBloque(lang, 'proyectos', i, 'proyecto', <>Proyecto de la web <small>de aquí sale el enlace</small></>, {
                        compartido: true,
                        control: ({ id, valor, poner, error }) => (
                          <select id={id} value={valor} onChange={(e) => poner(e.target.value)} {...conError(id, error)}>
                            <option value="">Elige uno…</option>
                            {opciones.proyectos.map((o) => (
                              <option key={o.slug} value={o.slug}>
                                {o.nombre}
                              </option>
                            ))}
                          </select>
                        ),
                      })}
                      {campoBloque(lang, 'proyectos', i, 'desde', 'Desde', { compartido: true, control: mesInput })}
                      {campoBloque(lang, 'proyectos', i, 'hasta', 'Hasta', { compartido: true, control: mesInput })}
                    </div>
                    {campoBloque(lang, 'proyectos', i, 'descripcion', 'Descripción', { largo: true })}
                    {puntos(lang, 'proyectos', i)}
                    {!p.hasta && <p className="ayuda nota-bloque">Sin «hasta»: el CV dirá que sigue en curso.</p>}
                  </>
                ))}
              </Bloque>

              <Bloque
                n="04"
                titulo="Experiencia"
                cambios={cambiosDe('experiencia')}
                texto="Puedes agrupar varios empleos de la web en un bloque (por ejemplo, VTC y taxi). El generador los ordena por fechas."
              >
                {lista(lang, 'experiencia', 'Bloque', '+ Añadir bloque', (e, i) => {
                  const fechas = fechasDe(opciones.empleos.filter((o) => e.empleos.includes(o.slug)))
                  return (
                    <>
                      <div className="fila-campos">
                        {campoBloque(lang, 'experiencia', i, 'puesto', 'Puesto')}
                        {campoBloque(lang, 'experiencia', i, 'empresa', 'Empresa')}
                        {campoBloque(lang, 'experiencia', i, 'lugar', 'Lugar')}
                      </div>
                      {campoBloque(lang, 'experiencia', i, 'empleos', <>Enganchado a <small>de aquí salen las fechas</small></>, {
                        compartido: true,
                        control: ({ id, valor, poner }) => (
                          <SelectorTecnologias
                            id={id}
                            todas={empleos}
                            valor={valor}
                            alCambiar={poner}
                            placeholder="Añadir empleo…"
                            sinResultados="No está en la web. Los empleos se añaden en Trayectoria (ADM-06)."
                          />
                        ),
                      })}
                      <div className="solo-lectura">
                        Fechas: <b>{fechas ?? '—'}</b>
                        <span className="chip gris">De la web</span>
                      </div>
                      {campoBloque(lang, 'experiencia', i, 'descripcion', 'Descripción')}
                      {puntos(lang, 'experiencia', i)}
                    </>
                  )
                })}
              </Bloque>

              <Bloque n="05" titulo="Educación" cambios={cambiosDe('educacion')} texto="El generador la ordena por fechas.">
                {lista(lang, 'educacion', 'Formación', '+ Añadir formación', (e, i) => {
                  const enganchada = opciones.formacion.find((o) => o.slug === e.formacion)
                  return (
                    <>
                      <div className="fila-campos">
                        {campoBloque(lang, 'educacion', i, 'titulo', 'Título')}
                        {campoBloque(lang, 'educacion', i, 'centro', 'Centro')}
                        {campoBloque(lang, 'educacion', i, 'lugar', 'Lugar')}
                      </div>
                      {campoBloque(lang, 'educacion', i, 'formacion', <>Enganchada a <small>de aquí salen las fechas</small></>, {
                        compartido: true,
                        control: ({ id, valor, poner, error }) => (
                          <select id={id} value={valor} onChange={(ev) => poner(ev.target.value)} {...conError(id, error)}>
                            <option value="">Elige una…</option>
                            {opciones.formacion.map((o) => (
                              <option key={o.slug} value={o.slug}>
                                {o.titulo}
                              </option>
                            ))}
                          </select>
                        ),
                      })}
                      <div className="solo-lectura">
                        Fechas: <b>{(enganchada && fechasDe([enganchada])) ?? '—'}</b>
                        <span className="chip gris">De la web</span>
                      </div>
                    </>
                  )
                })}
              </Bloque>

              <Bloque n="06" titulo="Habilidades" cambios={cambiosDe('habilidades')} texto="Por grupos, como las buscan las ofertas. Escribe y pulsa Intro.">
                {lista(lang, 'habilidades', 'Grupo', '+ Añadir grupo', (g, i) => (
                  <>
                    {campoBloque(lang, 'habilidades', i, 'grupo', 'Grupo')}
                    {campoBloque(lang, 'habilidades', i, 'lista', 'Habilidades', {
                      control: ({ id, valor, poner }) => <FichasLibres id={id} valor={valor} alCambiar={poner} placeholder="Añadir habilidad…" />,
                    })}
                  </>
                ))}
              </Bloque>
            </>
          )}
        </PestanasIdioma>
      </form>

      <div className="barra-guardar">
        {numErrores > 0 || fallo ? (
          <p className="mal">✕ No se ha guardado: revisa lo marcado</p>
        ) : total > 0 ? (
          <p className="aviso">● {cambios(total)} sin guardar</p>
        ) : (
          <p>{actualizado ? `Guardado ${cuandoSeGuardo(actualizado)}` : ''}</p>
        )}
        <div className="acciones">
          <button className="boton azul" type="button" onClick={guardar} disabled={guardando || total === 0}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <AvisoSalir cuantos={total} />
    </>
  )
}
