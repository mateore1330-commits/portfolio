// Lo que comparten la pantalla de Conocimientos y sus diálogos (ADM-07), y el selector de
// tecnologías de los proyectos: los grupos y los tres niveles (con la etiqueta fija que
// pone la API, conocimientos.py).
export const GRUPOS = {
  frontend: 'Frontend',
  backend: 'Backend',
  data: 'Datos',
  tools: 'Herramientas',
  design: 'Diseño',
  soft: 'Transversal',
}

export const NIVELES = [
  { valor: null, corto: 'Sin nivel', largo: 'Sin nivel' },
  { valor: 33, corto: 'Lo he usado', largo: 'Lo he usado' },
  { valor: 67, corto: 'Sólido', largo: 'Sólido' },
  { valor: 100, corto: 'A diario', largo: 'Lo uso a diario' },
]

export const TIPOS_ENLACE = { email: 'Correo', linkedin: 'LinkedIn', github: 'GitHub', cv: 'CV', other: 'Otro' }

// El texto de un error de la API, por campo.
export function mensaje(campo, codigo) {
  if (codigo === 'obligatorio') return 'Hace falta para guardar.'
  if (codigo === 'existe') return 'Ya hay una tecnología con este nombre.'
  if (codigo === 'largo') return 'Demasiado largo: 80 caracteres como mucho.'
  if (codigo === 'url') return 'No parece una dirección completa: empieza por https://'
  if (codigo === 'correo') return 'No parece un correo: escribe algo como info@ejemplo.com'
  if (codigo === 'necesario') return 'El CV necesita este enlace: no se le puede cambiar el tipo.'
  if (codigo === 'falta') return `Pon también la etiqueta en ${campo.endsWith('.en') ? 'inglés' : 'español'}.`
  if (codigo === 'numero') return 'Un número, de 1 en adelante.'
  return 'Revisa este campo.'
}
