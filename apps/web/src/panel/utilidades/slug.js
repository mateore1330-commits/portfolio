// La dirección de un proyecto a partir de su nombre, igual que la API (proyectos.py):
// "Blog Dragón Ball" → "blog-dragon-ball". Sin tildes, la ñ como n y guiones.
const LARGO = 80

export function aSlug(texto) {
  return texto
    .normalize('NFKD')
    .replace(/[^\u0020-\u007e]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO)
    .replace(/-+$/, '')
}

export const FORMATO_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
