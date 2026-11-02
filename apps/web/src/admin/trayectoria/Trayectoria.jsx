import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router'
import { pedir } from '@/admin/api.js'
import { useAvisar } from '@/admin/comun/avisos.js'
import { Banda, Cabecera, Vacio } from '@/admin/comun/Estados.jsx'
import { ordenarPor, useGuardarOrden } from '@/admin/comun/orden.js'
import ListaOrdenable, { Asa, Ordenable } from '@/admin/comun/Ordenable.jsx'
import { TIPOS, fechas } from '@/admin/trayectoria/campos.js'
import { ponerTitulo } from '@/i18n/documento.js'

const PESTANAS = [
  { id: 'experiencia', nombre: 'Experiencia', tipo: TIPOS.empleo },
  { id: 'formacion', nombre: 'Formación', tipo: TIPOS.formacion },
]
const TIPO_FORMACION = { program: 'Formación', course: 'Curso' }

// 9 · Trayectoria (aprobada en ADM-00): los empleos y la formación en dos pestañas. Ocultar
// quita algo de la web sin borrarlo, y se guarda al pulsarlo. Los solapes de fechas se
// avisan, sin impedir nada. La pestaña va en la dirección (?ver=formacion). El orden de
// cada pestaña se cambia arrastrando el asa ⋮⋮ (ADM-09).
export default function Trayectoria() {
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const actual = PESTANAS.find((p) => p.id === params.get('ver')) ?? PESTANAS[0]
  const [datos, setDatos] = useState({}) // { experiencia: {lista, solapes}, formacion: {…} }
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    ponerTitulo('Trayectoria · Panel')
  }, [])

  useEffect(() => {
    let vivo = true
    Promise.all(PESTANAS.map((p) => pedir(p.tipo.api))).then((respuestas) => {
      if (!vivo) return
      const falla = respuestas.find((r) => !r.ok)
      if (falla) setError(falla.error)
      else setDatos(Object.fromEntries(PESTANAS.map((p, i) => [p.id, respuestas[i].datos])))
    })
    return () => {
      vivo = false
    }
  }, [intento])

  const recargar = useCallback(() => {
    setError(null)
    setIntento((n) => n + 1)
  }, [])

  const guardarOrden = useGuardarOrden({ alGuardar: cargarResumen, alDesfasar: recargar })
  const mover = (pestana) => (ids) =>
    guardarOrden({
      ruta: `${pestana.tipo.api}/orden`,
      ids,
      antes: datos[pestana.id].lista.map((f) => f.id),
      poner: (orden) =>
        setDatos((d) => ({ ...d, [pestana.id]: { ...d[pestana.id], lista: ordenarPor(d[pestana.id].lista, orden) } })),
    })

  // Ocultar o mostrar: al momento, como la estrella de Proyectos.
  const verEnLaWeb = async (pestana, fila) => {
    const r = await pedir(`${pestana.tipo.api}/${fila.id}`, { method: 'PATCH', body: JSON.stringify({ is_visible: !fila.is_visible }) })
    if (r.ok) {
      avisar('ok', `${r.datos.is_visible ? 'Visible' : 'Oculta'}. Se verá en la web al publicar.`)
      recargar()
      cargarResumen()
    } else if (r.error === 'incompleto') {
      avisar('error', 'Para mostrarla tiene que estar completa en los dos idiomas. Ábrela y complétala.')
    } else avisar('error', 'No se ha guardado. Vuelve a probar.')
  }

  const cabecera = (
    <Cabecera titulo="Trayectoria" texto="Tus empleos y tu formación, en el orden de la web: arrástralos por ⋮⋮ para cambiarlo. Ocultar quita algo de la web sin borrarlo.">
      <Link className="boton" to={`${TIPOS.empleo.ruta}/nuevo`}>
        + Nuevo empleo
      </Link>
      <Link className="boton" to={`${TIPOS.formacion.ruta}/nuevo`}>
        + Nueva formación
      </Link>
    </Cabecera>
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
          <b>No se ha podido cargar la trayectoria.</b> {error === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
        </Banda>
      </>
    )
  }

  const cargado = datos[actual.id]

  return (
    <>
      {cabecera}
      <div className="tabs" role="tablist" aria-label="Trayectoria">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={p.id === actual.id}
            onClick={() => setParams(p.id === 'experiencia' ? {} : { ver: p.id }, { replace: true })}
          >
            {p.nombre}
            {datos[p.id] && ` · ${datos[p.id].lista.length}`}
          </button>
        ))}
      </div>

      {!cargado ? (
        <div className="filas-cargando" aria-busy="true" aria-label="Cargando la trayectoria">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <span className="hueco grande" />
              <span className="hueco corto" />
            </div>
          ))}
        </div>
      ) : cargado.lista.length === 0 ? (
        <Vacio icono="▢" titulo={actual.id === 'experiencia' ? 'Sin empleos' : 'Sin formación'}>
          <p>Añade el primero. El CV usa {actual.id === 'experiencia' ? 'estos empleos' : 'esta formación'} para sus fechas.</p>
          <Link className="boton azul" to={`${actual.tipo.ruta}/nuevo`}>
            + {actual.tipo.nuevo}
          </Link>
        </Vacio>
      ) : (
        <>
          {cargado.solapes.length > 0 && (
            <Banda tipo="info">
              <b>Aviso:</b>{' '}
              {cargado.solapes
                .map(([a, b]) => `${a.empresa} (${fechas(a.desde, a.hasta)}) y ${b.empresa} (${fechas(b.desde, b.hasta)})`)
                .join('; ')}{' '}
              se solapan. Es solo un aviso: puede ser correcto.
            </Banda>
          )}
          <Tabla pestana={actual} lista={cargado.lista} alVerEnLaWeb={verEnLaWeb} alMover={mover(actual)} />
        </>
      )}
    </>
  )
}

function Tabla({ pestana, lista, alVerEnLaWeb, alMover }) {
  const formacion = pestana.id === 'formacion'
  const nombreDe = (f) => (formacion ? f.title : f.position)?.es || f.slug
  return (
    <table className="tabla">
      <thead>
        <tr>
          <th>
            <span className="solo-lector">Ordenar</span>
          </th>
          <th>{formacion ? 'Título' : 'Puesto'}</th>
          {formacion && <th className="ocultar-movil">Tipo</th>}
          <th>Fechas</th>
          {formacion && <th className="ocultar-movil">Certificado</th>}
          <th>En la web</th>
          <th>
            <span className="solo-lector">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <ListaOrdenable ids={lista.map((f) => f.id)} nombre={(id) => nombreDe(lista.find((f) => f.id === id))} alMover={alMover}>
          {lista.map((f) => {
            const nombre = nombreDe(f)
            const sub = formacion
              ? [f.institution ?? 'Por mi cuenta', f.hours && `${f.hours} h`].filter(Boolean).join(' · ')
              : [f.company, f.location].filter(Boolean).join(' · ')
            const certificado = [f.certificate_url && 'enlace', f.certificate_file && 'PDF'].filter(Boolean).join(' · ')
            const ruta = `${pestana.tipo.ruta}/${f.id}`
            return (
              <Ordenable key={f.id} id={f.id} como="tr" className={f.is_visible ? undefined : 'atenuada'}>
                <td className="posicion">
                  <Asa nombre={nombre} />
                </td>
                <td>
                  <p className="nom">
                    <Link to={ruta}>{nombre}</Link>
                  </p>
                  <p className="sub">{sub}</p>
                </td>
                {formacion && (
                  <td className="ocultar-movil">
                    <span className="chip gris">{TIPO_FORMACION[f.kind]}</span>
                  </td>
                )}
                <td className="fecha">{fechas(f.start_date, f.end_date)}</td>
                {formacion && (
                  <td className={`ocultar-movil certificado${certificado ? ' con' : ''}`}>{certificado ? `✓ ${certificado}` : '—'}</td>
                )}
                <td>
                  {f.is_visible ? (
                    <span className="chip pub">
                      <i />
                      Visible
                    </span>
                  ) : (
                    <span className="chip bor">
                      <i />
                      Oculta
                    </span>
                  )}
                </td>
                <td className="der">
                  <Link className="boton pequeno" to={ruta} aria-label={`Editar ${nombre}`}>
                    Editar
                  </Link>
                  <button className="enlace gris" type="button" onClick={() => alVerEnLaWeb(pestana, f)}>
                    {f.is_visible ? 'Ocultar' : 'Mostrar'}
                  </button>
                </td>
              </Ordenable>
            )
          })}
        </ListaOrdenable>
      </tbody>
    </table>
  )
}
