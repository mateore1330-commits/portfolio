import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { pedir } from '@/admin/api.js'
import { useAvisar } from '@/admin/comun/avisos.js'
import { Banda, Cabecera, Vacio } from '@/admin/comun/Estados.jsx'
import { rutaProyecto } from '@/admin/proyectos/campos.js'
import DialogoBorrar from '@/admin/proyectos/DialogoBorrar.jsx'
import { RUTA_PANEL } from '@/admin/ruta.js'
import { ponerTitulo } from '@/i18n/documento.js'

const FILTROS = [
  { id: 'todos', nombre: 'Todos', vale: () => true },
  { id: 'published', nombre: 'Publicados', vale: (p) => p.status === 'published' },
  { id: 'draft', nombre: 'Borradores', vale: (p) => p.status === 'draft' },
]

// 4 · Proyectos (aprobada en ADM-00): todos, en el orden de la web, con su estado y la
// estrella de destacado, que se guarda al pulsarla. Arrastrar para ordenar llega en ADM-09.
export default function Proyectos() {
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [aBorrar, setABorrar] = useState(null)
  const [intento, setIntento] = useState(0)

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

  // La estrella: cambia al momento y, si la API falla, vuelve a como estaba.
  const destacar = async (p) => {
    const nuevo = !p.is_featured
    const poner = (valor) => setLista((l) => l.map((x) => (x.id === p.id ? { ...x, is_featured: valor, guardando: false } : x)))
    setLista((l) => l.map((x) => (x.id === p.id ? { ...x, is_featured: nuevo, guardando: true } : x)))
    const r = await pedir(`/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify({ is_featured: nuevo }) })
    poner(r.ok ? nuevo : !nuevo)
    if (r.ok) avisar('ok', 'Guardado. Se verá en la web al publicar.')
    else avisar('error', 'No se ha guardado la estrella. Ha vuelto a como estaba.')
  }

  const cabecera = (
    <Cabecera
      titulo="Proyectos"
      texto="En el orden de la web. Cámbialo con «Posición» al editar un proyecto. Los borradores no se ven en la web."
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
      {visibles.length === 0 ? (
        <p className="nota-vacia">No hay ninguno con este estado.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>
                <span className="solo-lector">Posición</span>
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
            {visibles.map((p) => {
              const nombre = p.name.es || p.slug
              return (
                <tr key={p.id}>
                  <td className="posicion" aria-label={`Posición ${p.posicion}`}>
                    {p.posicion}
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
                    <button
                      className={`estrella${p.is_featured ? '' : ' off'}`}
                      type="button"
                      aria-pressed={p.is_featured}
                      aria-label={`Destacado: ${nombre}`}
                      disabled={p.guardando}
                      onClick={() => destacar(p)}
                    >
                      {p.is_featured ? '★' : '☆'}
                    </button>
                  </td>
                  <td className="der">
                    <Link className="boton pequeno" to={rutaProyecto(p.id)} aria-label={`Editar ${nombre}`}>
                      Editar
                    </Link>
                    <button className="enlace borrar" type="button" onClick={() => setABorrar(p)} aria-label={`Borrar ${nombre}`}>
                      Borrar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
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
