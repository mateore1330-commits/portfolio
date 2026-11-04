import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { pedir } from '@/panel/utilidades/api.js'
import { useAvisar } from '@/panel/comun/avisos.js'
import { Banda, Cabecera, Vacio } from '@/panel/comun/Estados.jsx'
import { ordenarPor, useGuardarOrden } from '@/panel/comun/orden.js'
import ListaOrdenable, { Asa, Ordenable } from '@/panel/comun/Ordenable.jsx'
import { avisoDestacado, conDestacado, rutaProyecto } from '@/panel/proyectos/campos.js'
import DialogoBorrar from '@/panel/proyectos/DialogoBorrar.jsx'
import DialogoDestacado from '@/panel/proyectos/DialogoDestacado.jsx'
import { RUTA_PANEL } from '@/panel/utilidades/ruta.js'
import { ponerTitulo } from '@/idioma/documento.js'

const nombreDe = (p) => p.name.es || p.slug
const FILTROS = [
  { id: 'todos', nombre: 'Todos', vale: () => true },
  { id: 'published', nombre: 'Publicados', vale: (p) => p.status === 'published' },
  { id: 'draft', nombre: 'Borradores', vale: (p) => p.status === 'draft' },
]

// 4 · Proyectos (aprobada en ADM-00): todos, en el orden de la web, con su estado y la
// estrella de destacado. El orden se cambia arrastrando el asa ⋮⋮ (ADM-09), solo viéndolos
// todos: con un filtro no se sabe dónde caen los ocultos. El destacado es siempre uno, el
// primer publicado, y va el primero (#154): cambiarlo, con la estrella o arrastrando, pide
// confirmación en la misma ventana.
export default function Proyectos() {
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [aBorrar, setABorrar] = useState(null)
  const [intento, setIntento] = useState(0)
  const [pendiente, setPendiente] = useState(null) // { nuevo, anterior, aceptar, cancelar }

  useEffect(() => {
    ponerTitulo('Proyectos · Panel')
  }, [])

  useEffect(() => {
    let vivo = true
    pedir('/projects').then((r) => {
      if (!vivo) return
      if (r.ok) setLista(r.datos)
      else setError(r.error)
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
  const destacado = lista?.find((p) => p.is_featured)

  // Arrastrar. La lista se enseña ya como quedará (con la regla del destacado: un borrador
  // puesto arriba queda debajo de él). Si cambia el destacado, antes se pregunta.
  const mover = (ids) => {
    const antes = lista.map((p) => p.id)
    const poner = (orden) => setLista((l) => conDestacado(ordenarPor(l, orden)))
    const nueva = conDestacado(ordenarPor(lista, ids))
    const sera = nueva.find((p) => p.is_featured)
    const guardar = (aviso) => guardarOrden({ ruta: '/projects/orden', ids, antes, poner, aviso })
    poner(ids)
    if (destacado && sera && sera.id !== destacado.id) {
      setPendiente({
        nuevo: nombreDe(sera),
        anterior: nombreDe(destacado),
        aceptar: () => guardar(avisoDestacado({ antes: nombreDe(destacado), ahora: nombreDe(sera) })),
        cancelar: () => poner(antes),
      })
    } else if (sera && ids[0] !== sera.id) {
      // Arriba se ha soltado un borrador: la regla lo deja segundo.
      guardar(`Orden guardado. Un borrador no puede ser el destacado: queda debajo de ${nombreDe(sera)}.`)
    } else guardar()
  }

  // La estrella de un publicado que no es el destacado: lo hace destacado, tras preguntar.
  const destacar = (p) =>
    setPendiente({
      nuevo: nombreDe(p),
      anterior: destacado && nombreDe(destacado),
      aceptar: async () => {
        const r = await pedir(`/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify({ is_featured: true }) })
        if (r.ok) {
          avisar('ok', avisoDestacado(r.datos.cambio_destacado ?? { ahora: nombreDe(p) }))
          recargar()
          cargarResumen()
        } else if (r.error === 'borrador') avisar('error', 'Un borrador no puede ser el destacado: publícalo primero.')
        else avisar('error', 'No se ha guardado. Vuelve a probar.')
      },
    })

  const cerrarPendiente = (aceptado) => {
    const { aceptar, cancelar } = pendiente
    setPendiente(null)
    if (aceptado) aceptar()
    else cancelar?.()
  }

  const cabecera = (
    <Cabecera
      titulo="Proyectos"
      texto="En el orden de la web: arrástralos por ⋮⋮ para cambiarlo. Los borradores no se ven en la web."
    >
      <Link className="boton" to={`${RUTA_PANEL}/proyectos/nuevo`}>
        + Nuevo proyecto
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
          <b>No se ha podido cargar la lista.</b> {error === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
        </Banda>
      </>
    )
  }

  if (!lista) {
    return (
      <>
        {cabecera}
        <div className="filas-cargando" aria-busy="true" aria-label="Cargando los proyectos">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <span className="hueco grande" />
              <span className="hueco" />
              <span className="hueco corto" />
            </div>
          ))}
        </div>
      </>
    )
  }

  if (lista.length === 0) {
    return (
      <>
        {cabecera}
        <Vacio icono="▢" titulo="Todavía no hay proyectos">
          <p>
            Crea el primero: quedará como <b>borrador</b> hasta que lo marques como publicado y publiques.
          </p>
          <Link className="boton azul" to={`${RUTA_PANEL}/proyectos/nuevo`}>
            + Nuevo proyecto
          </Link>
        </Vacio>
      </>
    )
  }

  const visibles = lista.filter(FILTROS.find((f) => f.id === filtro).vale)

  return (
    <>
      {cabecera}
      <div className="filtros" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.nombre} · {lista.filter(f.vale).length}
          </button>
        ))}
      </div>
      {filtro !== 'todos' && visibles.length > 0 && <p className="nota-lista">Para cambiar el orden, vuelve a «Todos».</p>}
      {visibles.length === 0 ? (
        <p className="nota-vacia">No hay ninguno con este estado.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>
                <span className="solo-lector">Ordenar</span>
              </th>
              <th>Proyecto</th>
              <th className="ocultar-movil">Tipo</th>
              <th>Estado</th>
              <th>Destacado</th>
              <th>
                <span className="solo-lector">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <ListaOrdenable
              ids={visibles.map((p) => p.id)}
              nombre={(id) => nombreDe(lista.find((p) => p.id === id))}
              alMover={mover}
              apagada={filtro === 'todos' ? null : 'quita el filtro para ordenar'}
            >
              {visibles.map((p) => {
                const nombre = nombreDe(p)
                return (
                  <Ordenable key={p.id} id={p.id} como="tr">
                    <td className="posicion">
                      <Asa nombre={nombre} />
                    </td>
                    <td>
                      <p className="nom">
                        <Link to={rutaProyecto(p.id)}>{nombre}</Link>
                      </p>
                      <p className="sub">
                        /proyectos/{p.slug} · {p.tecnologias === 1 ? '1 tecnología' : `${p.tecnologias} tecnologías`}
                      </p>
                    </td>
                    <td className="gris ocultar-movil">{p.label?.es || '—'}</td>
                    <td>
                      {p.status === 'published' ? (
                        <span className="chip pub">
                          <i />
                          Publicado
                        </span>
                      ) : (
                        <span className="chip bor">
                          <i />
                          Borrador
                        </span>
                      )}
                    </td>
                    <td>
                      <Estrella proyecto={p} nombre={nombre} alDestacar={() => destacar(p)} />
                    </td>
                    <td className="der">
                      <Link className="boton pequeno" to={rutaProyecto(p.id)} aria-label={`Editar ${nombre}`}>
                        Editar
                      </Link>
                      <button className="enlace borrar" type="button" onClick={() => setABorrar(p)} aria-label={`Borrar ${nombre}`}>
                        Borrar
                      </button>
                    </td>
                  </Ordenable>
                )
              })}
            </ListaOrdenable>
          </tbody>
        </table>
      )}
      <DialogoDestacado cambio={pendiente} alAceptar={() => cerrarPendiente(true)} alCancelar={() => cerrarPendiente(false)} />
      <DialogoBorrar
        proyecto={aBorrar}
        alCerrar={() => setABorrar(null)}
        alBorrar={() => {
          setABorrar(null)
          recargar()
          cargarResumen()
        }}
      />
    </>
  )
}

// La estrella (#154): en el destacado, encendida; en un borrador, apagada. Las dos dicen
// por qué no hacen nada (aria-disabled y no disabled: así se puede llegar con el teclado y
// leer el motivo).
function Estrella({ proyecto, nombre, alDestacar }) {
  const motivo = proyecto.is_featured
    ? 'Es el destacado. Para cambiarlo, marca otro.'
    : proyecto.status !== 'published'
      ? 'Publícalo para poder destacarlo.'
      : null
  return (
    <button
      className={`estrella${proyecto.is_featured ? '' : ' off'}`}
      type="button"
      aria-pressed={proyecto.is_featured}
      aria-label={`Destacado: ${nombre}${motivo ? `. ${motivo}` : ''}`}
      aria-disabled={motivo ? true : undefined}
      title={motivo ?? 'Hacerlo el destacado'}
      onClick={motivo ? undefined : alDestacar}
    >
      {proyecto.is_featured ? '★' : '☆'}
    </button>
  )
}
