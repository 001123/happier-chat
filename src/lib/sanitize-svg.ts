// Makes a model-written SVG drawing safe to put in the page: shapes, text and presentation attributes only.

import DOMPurify from 'dompurify'
import type { Config } from 'dompurify'

// Scripts and on* handlers always go; these could also load other resources, embed HTML or animate a link into one.
const FORBID_TAGS = ['style', 'foreignObject', 'image', 'a', 'use', 'animate', 'set', 'animateMotion', 'animateTransform']
const FORBID_ATTR = ['style', 'href', 'xlink:href']
const CONFIG: Config = { USE_PROFILES: { svg: true }, FORBID_TAGS, FORBID_ATTR }
const LOCAL_URL = /^url\(\s*#[^)]*\)$/

let purifier: ReturnType<typeof DOMPurify> | null = null
let prefix = ''

/** A DOMPurify of its own, so these hooks never touch other sanitizing. */
function getPurifier() {
  if (purifier) return purifier
  const purify = DOMPurify(window)
  purify.addHook('uponSanitizeAttribute', (_node, data) => {
    // Only references inside the drawing (a marker, a gradient): url() could fetch from anywhere.
    if (/url\s*\(/i.test(data.attrValue) && !LOCAL_URL.test(data.attrValue.trim())) data.keepAttr = false
  })
  purify.addHook('afterSanitizeAttributes', (node) => {
    // A part the narration introduces becomes a build step, drawn in when the narrator reaches its words.
    const say = node.getAttribute('data-say')
    if (say !== null) {
      node.removeAttribute('data-say')
      node.setAttribute('data-build', '')
      node.setAttribute('data-build-label', say)
    }
    // Ids are made unique to the drawing, so two slides with an "arrow" marker do not borrow each other's.
    const id = node.getAttribute('id')
    if (id) node.setAttribute('id', `${prefix}-${id}`)
    for (const attr of Array.from(node.attributes)) {
      if (attr.value.includes('url(#')) node.setAttribute(attr.name, attr.value.replace(/url\(\s*#/g, `url(#${prefix}-`))
    }
  })
  purifier = purify
  return purify
}

/** The drawing as safe markup with ids prefixed by `id`, or an empty string when there is no SVG in it. Browser only. */
export function sanitizeSvg(source: string, id: string): string {
  const purify = getPurifier()
  prefix = id
  const clean = purify.sanitize(source.trim(), CONFIG) as unknown as string
  return /^<svg[\s>]/i.test(clean.trim()) ? clean : ''
}
