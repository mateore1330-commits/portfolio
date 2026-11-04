import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router'
import { pedir } from '@/panel/utilidades/api.js'
import AvisoSalir from '@/panel/comun/AvisoSalir.jsx'
import { useAvisar } from '@/panel/comun/avisos.js'
import Campo from '@/panel/comun/Campo.jsx'
import Dialogo from '@/panel/comun/Dialogo.jsx'
import { Banda, Cabecera, Vacio } from '@/panel/comun/Estados.jsx'
import { ordenarPor, useGuardarOrden } from '@/panel/comun/orden.js'
import ListaOrdenable, { Asa, Ordenable } from '@/panel/comun/Ordenable.jsx'
import SubirImagenes from '@/panel/comun/SubirImagenes.jsx'
import { useFormulario } from '@/panel/comun/useFormulario.js'
import { NoEncontrado } from '@/panel/Proximamente.jsx'
import { rutaProyecto } from '@/panel/proyectos/campos.js'
import { ponerTitulo } from '@/idioma/documento.js'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const IDIOMAS = [
  ['es', 'Texto alternativo · ES'],
  ['en', 'Alt text · EN'],
]
// Para el asa y el lector de pantalla: "la imagen 2" (las fotos no tienen nombre).
const nombreFoto = (imagenes, id) => `la imagen ${imagenes.findIndex((i) => i.id === id) + 1}`
const cambios = (n) => (n === 1 ? '1 cambio' : `${n} cambios`)
const aFormulario = (imagenes) =>
  Object.fromEntries(imagenes.flatMap((i) => IDIOMAS.map(([lang]) => [`${i.id}.${lang}`, i.alt?.[lang] ?? ''])))

// 6 · Imágenes de un proyecto (aprobada en ADM-00). Subir, hacer portada y borrar se
// guardan al momento, y también el orden al soltar (se arrastran por ⋮⋮, ADM-09); los
// textos alternativos, con la barra de guardar. La primera es la portada si no se elige otra.
export default function Imagenes() {
  const { id } = useParams()
  if (!/^\d+$/.test(id)) return <NoEncontrado />
  return <Pantalla key={id} id={id} />
}

function Pantalla({ id }) {
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const form = useFormulario()
  const { valores, cuantos } = form
  const [datos, setDatos] = useState(null) // { imagenes, nombre, publicado, nube }
  const [carga, setCarga] = useState('cargando')
  const [fallos, setFallos] = useState([])
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState(null)

  useEffect(() => {
    let vivo = true
    pedir(`/projects/${id}/media`).then((r) => {
      if (!vivo) return
      if (!r.ok) {
        setCarga(r.error === 'no_existe' ? 'no_existe' : r.error === 'red' ? 'red' : 'servidor')
        return
      }
      setDatos(r.datos)
      form.cargar(aFormulario(r.datos.imagenes))
      setCarga('lista')
    })
    return () => {
      vivo = false
    }
    // form.cargar no cambia nunca (useCallback sin dependencias).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (datos) ponerTitulo(`Imágenes · ${datos.nombre} · Panel`)
  }, [datos])

  // Lo que cambia al momento (subir, portada, borrar) actualiza la galería sin tocar los
  // textos alternativos que estés escribiendo.
  const ponerImagenes = (imagenes) => {
    setDatos((d) => ({ ...d, imagenes }))
    for (const i of imagenes) {
      for (const [lang] of IDIOMAS) {
        const clave = `${i.id}.${lang}`
        if (!(clave in valores)) form.fijar(clave, i.alt?.[lang] ?? '')
      }
    }
    cargarResumen()
  }

  // Si la galería había cambiado en otra pestaña, se vuelve a pedir (sin perder lo escrito).
  const guardarOrden = useGuardarOrden({
    alGuardar: cargarResumen,
    alDesfasar: async () => {
      const r = await pedir(`/projects/${id}/media`)
      if (r.ok) ponerImagenes(r.datos.imagenes)
    },
  })

  if (carga === 'no_existe') return <NoEncontrado />

  const volver = (
    <Link className="volver" to={rutaProyecto(id)}>
      ← {datos?.nombre ?? 'Proyecto'}
    </Link>
  )

  if (carga !== 'lista') {
    return (
      <>
        {volver}
        <Cabecera titulo="Imágenes" />
        {carga === 'cargando' ? (
          <div className="galeria" aria-busy="true" aria-label="Cargando las imágenes">
            {Array.from({ length: 3 }, (_, i) => (
              <div className="foto" key={i}>
                <span className="hueco alto" />
              </div>
            ))}
          </div>
        ) : (
          <Banda tipo="error">
            <b>No se han podido cargar las imágenes.</b> {carga === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
          </Banda>
        )}
      </>
    )
  }

  // Una recién subida: al final, con sus textos alternativos vacíos (ya está guardada).
  // Con la lista más reciente: si se suben varias, cada una se añade a la anterior.
  const anadir = (imagen) => {
    setDatos((d) => ({ ...d, imagenes: [...d.imagenes, imagen] }))
    for (const [lang] of IDIOMAS) form.fijar(`${imagen.id}.${lang}`, '')
    cargarResumen()
  }

  const mover = (ids) =>
    guardarOrden({
      ruta: `/projects/${id}/media/orden`,
      ids,
      antes: datos.imagenes.map((i) => i.id),
      poner: (orden) => setDatos((d) => ({ ...d, imagenes: ordenarPor(d.imagenes, orden) })),
    })

  const portada = async (imagen) => {
    const r = await pedir(`/media/${imagen.id}`, { method: 'PATCH', body: JSON.stringify({ is_cover: true }) })
    if (r.ok) {
      ponerImagenes(r.datos.imagenes)
      avisar('ok', 'Es la portada. Se verá en la web al publicar.')
    } else avisar('error', 'No se ha guardado. Vuelve a probar.')
  }

  const borrar = async () => {
    const r = await pedir(`/media/${aBorrar.id}`, { method: 'DELETE' })
    setABorrar(null)
    if (r.ok) {
      ponerImagenes(r.datos.imagenes)
      avisar('ok', 'Imagen borrada.')
    } else avisar('error', 'No se ha podido borrar.')
  }

  const guardar = async () => {
    setGuardando(true)
    const alts = Object.fromEntries(datos.imagenes.map((i) => [i.id, { es: valores[`${i.id}.es`], en: valores[`${i.id}.en`] }]))
    const r = await pedir(`/projects/${id}/media`, { method: 'PUT', body: JSON.stringify({ alts }) })
    setGuardando(false)
    if (!r.ok) {
      setErrores(r.error === 'validacion' ? r.datos.errores : { general: r.error })
      return
    }
    setErrores({})
    setDatos((d) => ({ ...d, imagenes: r.datos.imagenes }))
    form.cargar(aFormulario(r.datos.imagenes))
    cargarResumen()
    avisar('ok', 'Guardado. Se verá en la web al publicar.')
  }

  const { imagenes, nombre, publicado, nube } = datos
  const total = cuantos()
  const sinAlt = imagenes.filter((i) => !valores[`${i.id}.es`]?.trim() || !valores[`${i.id}.en`]?.trim()).length
  const hayPortada = imagenes.some((i) => i.is_cover)

  return (
    <>
      {volver}
      <Cabecera
        titulo="Imágenes"
        texto={`${nombre} · La primera es la portada si no eliges otra. Cada imagen necesita un texto alternativo en los dos idiomas (lo leen los lectores de pantalla).`}
      />

      {!nube && (
        <Banda tipo="error">
          <b>Ahora no se pueden subir imágenes:</b> falta configurar Cloudinary en el servidor. Las que ya hay siguen en la
          web.
        </Banda>
      )}
      {fallos.length > 0 && (
        <Banda
          tipo="error"
          acciones={
            <button className="enlace gris" type="button" onClick={() => setFallos([])}>
              Cerrar
            </button>
          }
        >
          <b>{fallos.length === 1 ? '1 archivo no se ha subido.' : `${fallos.length} archivos no se han subido.`}</b> {fallos.join(' · ')}.
        </Banda>
      )}
      {sinAlt > 0 && (
        <Banda tipo="aviso">
          <b>{sinAlt === 1 ? 'A 1 imagen le falta' : `A ${sinAlt} imágenes les falta`} el texto alternativo.</b>{' '}
          {publicado
            ? 'El proyecto está publicado: sin él, la foto no sale en la web y no podrás guardar los textos.'
            : 'Hace falta en los dos idiomas para publicar el proyecto.'}
        </Banda>
      )}

      <SubirImagenes
        ruta={`/projects/${id}/media`}
        tipos={TIPOS}
        formatos="JPG, PNG o WebP"
        deshabilitada={!nube}
        alSubido={(imagen) => {
          anadir(imagen)
          avisar('ok', 'Imagen subida. Escribe su texto alternativo.')
        }}
        alFallar={setFallos}
      />

      {imagenes.length === 0 ? (
        <Vacio icono="▢" titulo="Sin imágenes todavía">
          <p>En la web, la tarjeta y la página enseñan el hueco con la cámara hasta que subas la primera.</p>
        </Vacio>
      ) : (
        <div className="galeria">
          <ListaOrdenable ids={imagenes.map((i) => i.id)} nombre={(ident) => nombreFoto(imagenes, ident)} alMover={mover} rejilla>
            {imagenes.map((imagen, i) => {
              const esPortada = imagen.is_cover || (!hayPortada && i === 0)
              return (
                <Ordenable className="foto" key={imagen.id} id={imagen.id} como="article">
                  <div className="img">
                    <img src={imagen.url} alt={valores[`${imagen.id}.es`] || ''} loading="lazy" />
                    {esPortada && <span className="chip nuevo">ImagenProyecto</span>}
                    <Asa nombre={nombreFoto(imagenes, imagen.id)} className="asa asa-foto" />
                  </div>
                  <div className="datos">
                    {IDIOMAS.map(([lang, etiqueta]) => {
                      const clave = `${imagen.id}.${lang}`
                      const idCampo = `alt-${imagen.id}-${lang}`
                      const error = errores[clave] ? 'Hace falta: el proyecto está publicado.' : null
                      return (
                        <Campo
                          key={lang}
                          etiqueta={etiqueta}
                          id={idCampo}
                          error={error}
                          cambiado={form.cambiado(clave)}
                          alDeshacer={() => form.deshacer(clave)}
                        >
                          <input
                            id={idCampo}
                            type="text"
                            value={valores[clave] ?? ''}
                            onChange={(e) => {
                              form.poner(clave, e.target.value)
                              setErrores((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== clave)))
                            }}
                          />
                        </Campo>
                      )
                    })}
                    <div className="pie-foto">
                      {esPortada ? (
                        <span className="mono">Es la portada</span>
                      ) : (
                        <button className="enlace" type="button" onClick={() => portada(imagen)}>
                          Hacer portada
                        </button>
                      )}
                      <button className="enlace borrar" type="button" onClick={() => setABorrar(imagen)}>
                        Borrar
                      </button>
                    </div>
                  </div>
                </Ordenable>
              )
            })}
          </ListaOrdenable>
        </div>
      )}

      <div className="barra-guardar">
        {Object.keys(errores).length > 0 ? (
          <p className="mal">✕ No se ha guardado: revisa lo marcado</p>
        ) : total > 0 ? (
          <p className="aviso">● {cambios(total)} sin guardar</p>
        ) : (
          <p>Textos alternativos guardados</p>
        )}
        <div className="acciones">
          <button className="boton azul" type="button" onClick={guardar} disabled={guardando || total === 0}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <AvisoSalir cuantos={total} />
      <Dialogo abierto={Boolean(aBorrar)} titulo="Borrar la imagen" alCerrar={() => setABorrar(null)}>
        <p>
          Se quita del proyecto y de Cloudinary. Si ya sale en la web, se borra de Cloudinary <b>al publicar</b>, para que la web
          no enseñe una imagen rota. <b>No se puede deshacer.</b>
        </p>
        <div className="acciones">
          <button className="boton suave" type="button" onClick={() => setABorrar(null)} data-enfoque>
            Cancelar
          </button>
          <button className="boton peligro lleno" type="button" onClick={borrar}>
            Borrar la imagen
          </button>
        </div>
      </Dialogo>
    </>
  )
}
