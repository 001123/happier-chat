import { toolDefinition } from '@tanstack/ai'
import { applySpecStreamPatch, defineCatalog, validateSpec } from '@json-render/core'
import type { Spec, SpecStreamLine } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

const tone = z.enum(['default', 'muted', 'success', 'warning', 'danger'])

export const uiCatalog = defineCatalog(schema, {
  components: {
    Card: {
      props: z.object({ title: z.string().optional(), description: z.string().optional() }),
      description: 'Bordered container with an optional title and description. Use it as the root or to group content.',
    },
    Stack: {
      props: z.object({
        direction: z.enum(['vertical', 'horizontal']).optional(),
        gap: z.enum(['sm', 'md', 'lg']).optional(),
        align: z.enum(['start', 'center', 'end', 'between']).optional(),
      }),
      description: 'Arranges children in a column (default) or a row. Rows wrap onto a new line when space is narrow.',
    },
    Grid: {
      props: z.object({ columns: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
      description: 'Multi-column grid for Metric, small Card, or Image. Collapses to 1-2 columns on narrow screens.',
    },
    Heading: {
      props: z.object({ text: z.string(), level: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional() }),
      description: 'Section heading.',
    },
    Text: {
      props: z.object({ text: z.string(), tone: tone.optional(), size: z.enum(['sm', 'md']).optional() }),
      description: 'Regular paragraph of text.',
    },
    Badge: {
      props: z.object({ label: z.string(), tone: tone.optional() }),
      description: 'Small label for a status or category.',
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        hint: z.string().optional(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
      }),
      description: 'Metric tile: a label, a large value, and a small hint/trend below.',
    },
    Progress: {
      props: z.object({ label: z.string(), value: z.number().min(0).max(100), tone: tone.optional() }),
      description: 'Progress bar from 0 to 100 with a label and percentage.',
    },
    Table: {
      props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }),
      description: 'Data table: columns are the column headers, and rows is an array of rows (each row is an array of strings with the same length).',
    },
    List: {
      props: z.object({ items: z.array(z.string()), ordered: z.boolean().optional() }),
      description: 'Bulleted or numbered list.',
    },
    Image: {
      props: z.object({ src: z.string(), alt: z.string(), caption: z.string().optional() }),
      description: 'Image from a public https URL. Only use real URLs; never make up URLs.',
    },
    Separator: {
      props: z.object({}),
      description: 'Horizontal divider that separates content.',
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(['default', 'outline', 'secondary', 'ghost']).optional(),
      }),
      description: 'Button that emits a "press" event. Attach on.press with the ask action to send the choice to the assistant, or with setState to change state.',
    },
    Input: {
      props: z.object({
        label: z.string(),
        placeholder: z.string().optional(),
        value: z.string().optional(),
        type: z.enum(['text', 'number', 'email', 'date']).optional(),
      }),
      description: 'Text input field. Use { "$bindState": "/path" } for value.',
    },
    Switch: {
      props: z.object({ label: z.string(), checked: z.boolean().optional() }),
      description: 'On/off switch. Use { "$bindState": "/path" } for checked.',
    },
    Choice: {
      props: z.object({
        label: z.string().optional(),
        options: z.array(z.string()),
        value: z.string().optional(),
      }),
      description: 'Group for choosing one of several options (chip style). Use { "$bindState": "/path" } for value.',
    },
    Alert: {
      props: z.object({
        title: z.string(),
        description: z.string().optional(),
        tone: z.enum(['default', 'danger']).optional(),
      }),
      description: 'Highlighted notice box for notes and warnings (use tone danger for errors or risks).',
    },
    Tabs: {
      props: z.object({ labels: z.array(z.string()) }),
      description: 'Splits content into tabs. labels[i] is the tab name for the i-th child; the number of children must equal the number of labels.',
    },
    Accordion: {
      props: z.object({}),
      description: 'Collapsible/expandable list. children must only be AccordionItem.',
    },
    AccordionItem: {
      props: z.object({ title: z.string() }),
      description: 'One item in an Accordion: title is the clickable row that opens it, and children is the content inside.',
    },
    Select: {
      props: z.object({
        label: z.string().optional(),
        placeholder: z.string().optional(),
        options: z.array(z.string()),
        value: z.string().optional(),
      }),
      description: 'Dropdown for selecting one value, suited to many options (more than ~5). Use { "$bindState": "/path" } for value.',
    },
    Slider: {
      props: z.object({
        label: z.string(),
        min: z.number(),
        max: z.number(),
        step: z.number().optional(),
        unit: z.string().optional(),
        value: z.number().optional(),
      }),
      description: 'Slider for picking a number within a min-max range. Use { "$bindState": "/path" } for value.',
    },
    Checkbox: {
      props: z.object({ label: z.string(), checked: z.boolean().optional() }),
      description: 'Checkbox, suited to checklists or agreeing to terms. Use { "$bindState": "/path" } for checked.',
    },
  },
  actions: {
    ask: {
      params: z.object({ text: z.string() }),
      description:
        'Sends a message on the user\'s behalf into the conversation so you can reply. params always has a text key; use $template to insert form values, e.g. "on": { "press": { "action": "ask", "params": { "text": { "$template": "Book a table for ${/form/people} people at ${/form/time}" } } } }.',
    },
  },
})

const patchSchema = z.object({
  op: z.enum(['add', 'replace', 'remove']),
  path: z.string(),
  value: z.unknown().optional(),
})

const uiGuide = uiCatalog
  .prompt({
    system: 'How to build `patches` for render_ui. Each JSONL line below is ONE element of the `patches` array.',
    customRules: [
      'Use real data from the conversation or other tool results. Only use sample data when the user asks for a template.',
      'Keep the UI compact: usually one Card as the root, with at most about 25 elements.',
      'Write all UI text in Vietnamese, unless the user uses another language.',
      'When the user needs to choose or fill in information, use Choice/Select/Slider/Input/Switch/Checkbox with $bindState, then a Button with on.press calling the ask action.',
      'For long content or several parallel sections, use Tabs (number of children = number of labels) or Accordion > AccordionItem instead of stacking everything vertically.',
    ],
  })
  .replace(
    '1. Output ONLY JSONL patches - one JSON object per line, no markdown, no code fences',
    '1. Put every patch as an object in the `patches` array of render_ui. NEVER write patches or JSON in your text reply',
  )

function trimGuide(guide: string): string {
  const DROP_SECTIONS = ['ARRAY STATE ACTIONS:', 'STATE WATCHERS:']
  const DROP_LINES = [
    /^\d+\. When the user asks for a UI that displays data/,
    /^\d+\. Always include realistic, professional-looking sample data/,
    /^IMPORTANT: `watch` is a top-level field/,
  ]
  const out: Array<string> = []
  let skipping = false
  let rule = 0
  for (const line of guide.split('\n')) {
    if (DROP_SECTIONS.includes(line)) skipping = true
    else if (skipping && /^[A-Z][A-Z ()0-9-]*:/.test(line)) skipping = false
    if (skipping) continue
    if (DROP_LINES.some((re) => re.test(line))) continue
    out.push(/^\d+\. /.test(line) && out.includes('RULES:') ? line.replace(/^\d+/, String(++rule)) : line)
  }
  return out.join('\n')
}

export const renderUiDef = toolDefinition({
  name: 'render_ui',
  description: [
    'Displays an interactive interface (cards, tables, metrics, comparisons, forms, choices...) directly in the chat. Use it when content is easier to read visually, or when the user needs to choose or fill in information.',
    'The UI only appears when this tool is called: never write patches/JSON in the text reply. The text reply should be just 1-2 short sentences and must not repeat the UI content.',
    'Write that text in the same turn as the render_ui call: once the UI renders successfully the turn ends and you get no chance to add more.',
    '',
    trimGuide(uiGuide),
  ].join('\n'),
  inputSchema: z.object({
    patches: z.array(patchSchema).meta({
      description: 'RFC 6902 patches that build the UI spec; each element corresponds to one JSONL line in the guide above.',
    }),
  }),
  outputSchema: z.object({ rendered: z.boolean(), issues: z.array(z.string()) }),
})

const INLINE_PATCH = /^\s*\{\s*"op"\s*:/

export function splitInlinePatches(text: string): { text: string; patches: Array<unknown> } {
  if (!text.includes('"op"')) return { text, patches: [] }
  const patches: Array<unknown> = []
  const lines: Array<string> = []
  for (const line of text.split('\n')) {
    if (!INLINE_PATCH.test(line)) {
      if (!/^\s*```(json|jsonl)?\s*$/.test(line)) lines.push(line)
      continue
    }
    try {
      patches.push(JSON.parse(line))
    } catch {
    }
  }
  if (patches.length === 0) return { text, patches }
  return { text: lines.join('\n').trim(), patches }
}

export function buildSpec(patches: ReadonlyArray<unknown>): Spec | null {
  const spec: Record<string, unknown> = {}
  for (const patch of patches) {
    const parsed = patchSchema.safeParse(patch)
    if (!parsed.success) continue
    try {
      applySpecStreamPatch(spec, parsed.data as SpecStreamLine)
    } catch {
    }
  }
  if (typeof spec.root !== 'string' || !spec.elements) return null
  bindControls(spec as unknown as Spec)
  return spec as unknown as Spec
}

const BOUND_PROPS: Record<string, string> = {
  Input: 'value',
  Choice: 'value',
  Select: 'value',
  Slider: 'value',
  Switch: 'checked',
  Checkbox: 'checked',
}

/**
 * Models often forget $bindState on form controls. Bind each such control to a state path named after its key
 * (seeded with the literal value, if any) instead of rejecting the spec and costing another model turn.
 */
function bindControls(spec: Spec) {
  for (const [key, element] of Object.entries(spec.elements)) {
    const prop = BOUND_PROPS[element.type]
    if (!prop) continue
    const props = (element.props ?? {}) as Record<string, unknown>
    const value = props[prop]
    if (value && typeof value === 'object' && '$bindState' in value) continue
    const stateKey = key.replace(/[~/]/g, '_')
    const state = (spec.state ??= {}) as Record<string, unknown>
    if (value !== undefined && !(stateKey in state)) state[stateKey] = value
    element.props = { ...props, [prop]: { $bindState: `/${stateKey}` } }
  }
}

function readPointer(root: unknown, path: string): unknown {
  let node = root
  for (const part of path.split('/').slice(1)) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part.replace(/~1/g, '/').replace(/~0/g, '~')]
  }
  return node
}

export function specIssues(spec: Spec | null): Array<string> {
  if (!spec) return ['Spec is missing /root or /elements.']
  const issues = validateSpec(spec).issues.map((i) => i.message)
  for (const [key, element] of Object.entries(spec.elements)) {
    for (const binding of Object.values(element.on ?? {}).flat()) {
      if (binding.action === 'ask' && !(binding.params && 'text' in binding.params))
        issues.push(`elements/${key}: action ask requires params.text, e.g. { "text": { "$template": "..." } }`)
    }
  }
  const boundPaths = new Set<string>()
  for (const element of Object.values(spec.elements)) {
    for (const value of Object.values(element.props ?? {})) {
      if (value && typeof value === 'object' && '$bindState' in value) boundPaths.add(String(value.$bindState))
    }
  }
  for (const [key, element] of Object.entries(spec.elements)) {
    if (element.type === 'Button' && !element.on?.press)
      issues.push(`elements/${key}: Button needs on.press (usually the ask action), otherwise pressing it does nothing.`)
    for (const binding of Object.values(element.on ?? {}).flat()) {
      const text = binding.params?.text
      const template = text && typeof text === 'object' && '$template' in text ? String(text.$template) : ''
      for (const [, path] of template.matchAll(/\$\{(\/[^}]*)\}/g)) {
        if (!boundPaths.has(path!) && readPointer(spec.state, path!) === undefined)
          issues.push(`elements/${key}: \${${path}} in the ask template matches no control; bind a control to it with { "$bindState": "${path}" }.`)
      }
    }
  }
  for (const [key, element] of Object.entries(spec.elements)) {
    const children = element.children ?? []
    if (element.type === 'Tabs') {
      const labels = (element.props as { labels?: Array<unknown> }).labels ?? []
      if (labels.length !== children.length)
        issues.push(`elements/${key}: Tabs has ${labels.length} labels but ${children.length} children; the two counts must be equal.`)
    }
    if (element.type === 'Accordion') {
      for (const child of children)
        if (spec.elements[child] && spec.elements[child].type !== 'AccordionItem')
          issues.push(`elements/${key}: Accordion children must only be AccordionItem (${child} is ${spec.elements[child].type}).`)
    }
    if (element.type === 'AccordionItem') {
      const parent = Object.values(spec.elements).find((e) => e.children?.includes(key))
      if (parent?.type !== 'Accordion') issues.push(`elements/${key}: AccordionItem must be inside an Accordion.`)
    }
  }
  const result = uiCatalog.validate(spec)
  if (!result.success) issues.push(...(result.error?.issues.map((i) => `${i.path.join('/')}: ${i.message}`) ?? []))
  return issues
}
