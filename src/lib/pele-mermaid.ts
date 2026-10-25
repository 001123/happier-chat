import type { DiagramPlugin } from 'streamdown'

const MAX_DIAGRAM_WIDTH = 640

export const peleMermaid: DiagramPlugin = {
  name: 'mermaid',
  type: 'diagram',
  language: 'mermaid',
  getMermaid: () => ({
    initialize() {},
    async render(id, source) {
      const { renderAsync } = await import('pele/lazy')
      await document.fonts.ready
      const { svg } = await renderAsync(source, {
        idPrefix: id,
        fontFamily: "'Geist Variable', sans-serif",
        fontSize: 14,
        maxWidth: Math.min(MAX_DIAGRAM_WIDTH, window.innerWidth - 64),
        padding: 16,
      })
      return { svg }
    },
  }),
}
