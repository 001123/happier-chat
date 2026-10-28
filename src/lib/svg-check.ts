// Checks a model-written SVG drawing on the server, where there is no DOM, so a broken one goes back to be fixed.
// The browser sanitizes it anyway; these are the problems that would leave the slide blank or stripped.

const MAX_SVG_CHARS = 5000
const FORBIDDEN = /<\s*(script|foreignObject|image|iframe|style|a)\b/i
const TAG = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w:.-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/g

export function svgIssues(source: string): Array<string> {
  const svg = source.trim()
  const issues: Array<string> = []
  if (!/^<svg\b/i.test(svg)) issues.push('the drawing must start with <svg')
  else if (!/^<svg\b[^>]*\bviewBox\s*=/i.test(svg)) issues.push('<svg> needs viewBox="0 0 640 360"')
  if (svg.length > MAX_SVG_CHARS) issues.push(`the drawing is ${svg.length} characters; keep it under ${MAX_SVG_CHARS}`)
  const forbidden = svg.match(FORBIDDEN)
  if (forbidden) issues.push(`<${forbidden[1]}> is not allowed in a drawing`)
  const open: Array<string> = []
  for (const [whole, closing, name, selfClosing] of svg.matchAll(TAG)) {
    if (!name || whole.startsWith('<!--') || selfClosing) continue
    if (!closing) open.push(name)
    else if (open.at(-1) === name) open.pop()
    else return [...issues, `</${name}> does not close <${open.at(-1) ?? 'nothing'}>`]
  }
  if (open.length > 0) issues.push(`<${open.at(-1)}> is never closed`)
  return issues
}
