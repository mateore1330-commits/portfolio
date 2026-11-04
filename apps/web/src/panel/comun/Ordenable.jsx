import { createContext, useContext, useMemo, useRef } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Reordenar (ADM-09, maqueta ADM-00), con dnd-kit: se coge por el asa ⋮⋮ con el ratón o el
// dedo, o con el teclado (Espacio coge y suelta, las flechas mueven, Esc cancela). El
// lector de pantalla dice qué se ha cogido y en qué posición queda.
//
//   <ListaOrdenable ids={[…]} nombre={(id) => '…'} alMover={(ids) => …}>
//     {filas.map((f) => <Ordenable key={f.id} id={f.id} como="tr"><td><Asa /></td>…</Ordenable>)}
//   </ListaOrdenable>
//
// alMover recibe los ids en el orden nuevo, una vez por cada vez que se suelta.
// apagada: las asas se ven pero no mueven, y dicen el motivo (p. ej. un filtro puesto).

const Lista = createContext({ apagada: null })
const Elemento = createContext(null)

const INSTRUCCIONES = {
  draggable:
    'Para moverlo, pulsa Espacio. Con las flechas, cámbialo de sitio. Pulsa Espacio otra vez para soltarlo, o Escape para cancelar.',
}

export default function ListaOrdenable({ ids, nombre, alMover, rejilla = false, apagada = null, children }) {
  const sensores = useSensors(
    // Unos píxeles antes de empezar: un clic en el asa no mueve nada.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const posicion = (id) => `posición ${ids.indexOf(id) + 1} de ${ids.length}`
  // Nada más cogerlo, dnd-kit avisa de que está "encima de sí mismo": eso no se dice, para
  // que se oiga "Has cogido…".
  const movido = useRef(false)
  const anuncios = {
    onDragStart: ({ active }) => {
      movido.current = false
      return `Has cogido ${nombre(active.id)}, ${posicion(active.id)}.`
    },
    onDragOver: ({ active, over }) => {
      if (!over || (!movido.current && over.id === active.id)) return undefined
      movido.current = true
      return `${nombre(active.id)} pasa a la ${posicion(over.id)}.`
    },
    onDragEnd: ({ active, over }) =>
      over ? `Has soltado ${nombre(active.id)} en la ${posicion(over.id)}.` : `${nombre(active.id)} se queda donde estaba.`,
    onDragCancel: ({ active }) => `Cancelado. ${nombre(active.id)} vuelve a la ${posicion(active.id)}.`,
  }

  const soltar = ({ active, over }) => {
    if (!over || active.id === over.id) return
    alMover(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragEnd={soltar}
      // Sus textos ocultos para el lector, al final de la página: dentro de un <tbody> no valen.
      accessibility={{ announcements: anuncios, screenReaderInstructions: INSTRUCCIONES, container: document.body }}
    >
      <SortableContext items={ids} strategy={rejilla ? rectSortingStrategy : verticalListSortingStrategy} disabled={Boolean(apagada)}>
        <Lista.Provider value={{ apagada }}>{children}</Lista.Provider>
      </SortableContext>
    </DndContext>
  )
}

// Lo que se mueve: una fila (como="tr"), un párrafo, una foto… Lleva dentro su <Asa />.
export function Ordenable({ id, como: Etiqueta = 'div', className, children, ...resto }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    attributes: { roleDescription: 'elemento ordenable' },
  })
  const estilo = { transform: CSS.Translate.toString(transform), transition }
  const clases = [className, isDragging && 'arrastrando'].filter(Boolean).join(' ') || undefined
  const asa = useMemo(() => ({ setActivatorNodeRef, attributes, listeners }), [setActivatorNodeRef, attributes, listeners])
  return (
    <Elemento.Provider value={asa}>
      <Etiqueta ref={setNodeRef} style={estilo} className={clases} data-ordenable="" {...resto}>
        {children}
      </Etiqueta>
    </Elemento.Provider>
  )
}

// El asa ⋮⋮: lo único que coge el elemento (el resto de la fila sigue sirviendo para
// hacer scroll en el móvil y para pulsar sus botones).
export function Asa({ nombre, className = 'asa' }) {
  const { apagada } = useContext(Lista)
  const { setActivatorNodeRef, attributes, listeners } = useContext(Elemento)
  return (
    <button
      ref={setActivatorNodeRef}
      className={className}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={apagada ? `Mover ${nombre}: ${apagada}` : `Mover ${nombre}`}
      aria-disabled={apagada ? true : undefined}
      title={apagada ?? undefined}
    >
      ⋮⋮
    </button>
  )
}
