// Lo que comparten las tarjetas de la portada y la página de cada proyecto.

// El orden de la portada: el de la API (solo publicados, por sort_order), con el
// destacado primero. sort es estable: los demás no cambian de sitio.
export const ordenProyectos = (proyectos) =>
  [...proyectos].sort((a, b) => Number(b.is_featured) - Number(a.is_featured))

// /proyectos/cleanflow o /en/proyectos/cleanflow: el trozo "proyectos" no se traduce,
// como los id de las secciones.
export const rutaProyecto = (lang, slug) => `${lang === 'en' ? '/en' : ''}/proyectos/${slug}`

// 87 → "87 %" en español y "87%" en inglés.
export const porcentaje = (lang, valor) =>
  valor == null ? null : new Intl.NumberFormat(lang, { style: 'percent' }).format(valor / 100)

// La imagen de portada: la marcada como tal o, si no, la primera.
export const portadaDe = (proyecto) => proyecto.media.find((m) => m.is_cover) ?? proyecto.media[0]
