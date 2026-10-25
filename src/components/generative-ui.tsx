import * as React from 'react'
import { JSONUIProvider, Renderer, createStateStore, defineRegistry, useBoundProp } from '@json-render/react'
import { cn } from 'cn'
import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconMinus,
  IconSparkles,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { defineMessages, getLocale, useMessages } from '@/lib/i18n'
import { buildSpec, uiCatalog } from '@/lib/generative-ui'


// json-render drops writes when the model forgets $bindState; keep the control interactive with local state.
function useControlProp<T>(propValue: T | undefined, bindingPath: string | undefined) {
  const [bound, setBound] = useBoundProp(propValue, bindingPath)
  const [local, setLocal] = React.useState(propValue)
  return bindingPath ? ([bound, setBound] as const) : ([local, setLocal] as const)
}

const copy = defineMessages({
  vi: {
    item: (n: number) => `Mục ${n}`,
    choose: 'Chọn…',
    building: 'Đang dựng giao diện…',
  },
  en: {
    item: (n: number) => `Item ${n}`,
    choose: 'Select…',
    building: 'Building interface…',
  },
})

const TONE_TEXT = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
} as const

const TONE_BADGE = {
  default: 'bg-secondary text-secondary-foreground',
  muted: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  danger: 'bg-destructive/15 text-destructive',
} as const

const TONE_BAR = {
  default: '',
  muted: '[&_[data-slot=progress-indicator]]:bg-muted-foreground',
  success: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
  warning: '[&_[data-slot=progress-indicator]]:bg-amber-500',
  danger: '[&_[data-slot=progress-indicator]]:bg-destructive',
} as const

const GAP = { sm: 'gap-2', md: 'gap-3', lg: 'gap-5' } as const
const ALIGN = { start: 'items-start', center: 'items-center', end: 'items-end', between: 'items-center justify-between' } as const
const COLUMNS = { 2: 'sm:grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' } as const

const { registry } = defineRegistry(uiCatalog, {
  components: {
    Card: ({ props, children }) => (
      <Card>
        {(props.title || props.description) && (
          <CardHeader>
            {props.title && <CardTitle>{props.title}</CardTitle>}
            {props.description && <CardDescription>{props.description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="flex flex-col gap-3">{children}</CardContent>
      </Card>
    ),
    Stack: ({ props, children }) => (
      <div
        className={cn(
          'flex',
          props.direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col',
          GAP[props.gap ?? 'md'],
          props.align && ALIGN[props.align],
        )}>
        {children}
      </div>
    ),
    Grid: ({ props, children }) => <div className={cn('grid gap-3', COLUMNS[props.columns])}>{children}</div>,
    Heading: ({ props }) => {
      const Tag = `h${props.level ?? 3}` as 'h2' | 'h3' | 'h4'
      return (
        <Tag className={cn('font-medium', props.level === 2 ? 'text-lg' : props.level === 4 ? 'text-sm' : 'text-base')}>
          {props.text}
        </Tag>
      )
    },
    Text: ({ props }) => (
      <p className={cn(props.size === 'sm' ? 'text-sm' : 'text-[0.95rem]', TONE_TEXT[props.tone ?? 'default'])}>
        {props.text}
      </p>
    ),
    Badge: ({ props }) => <Badge className={TONE_BADGE[props.tone ?? 'default']}>{props.label}</Badge>,
    Metric: ({ props }) => {
      const Trend = props.trend === 'up' ? IconTrendingUp : props.trend === 'down' ? IconTrendingDown : IconMinus
      return (
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground">{props.label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{props.value}</div>
          {props.hint && (
            <div
              className={cn(
                'mt-1 flex items-center gap-1 text-xs',
                props.trend === 'up' ? TONE_TEXT.success : props.trend === 'down' ? TONE_TEXT.danger : TONE_TEXT.muted,
              )}>
              {props.trend && <Trend className="size-3.5" />}
              {props.hint}
            </div>
          )}
        </div>
      )
    },
    Progress: ({ props }) => {
      const value = Math.min(100, Math.max(0, props.value))
      return (
        <Progress value={value} className={cn('gap-1.5', TONE_BAR[props.tone ?? 'default'])}>
          <ProgressLabel className="font-normal">{props.label}</ProgressLabel>
          <ProgressValue />
        </Progress>
      )
    },
    Table: ({ props }) => (
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {props.columns.map((column, i) => (
                <TableHead key={i}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    ),
    List: ({ props }) => {
      const Tag = props.ordered ? 'ol' : 'ul'
      return (
        <Tag className={cn('flex flex-col gap-1 pl-5 text-[0.95rem]', props.ordered ? 'list-decimal' : 'list-disc')}>
          {props.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Tag>
      )
    },
    Image: ({ props }) => (
      <figure className="flex flex-col gap-1.5">
        <img src={props.src} alt={props.alt} loading="lazy" className="w-full rounded-xl border border-border object-cover" />
        {props.caption && <figcaption className="text-xs text-muted-foreground">{props.caption}</figcaption>}
      </figure>
    ),
    Separator: () => <Separator />,
    Button: ({ props, emit, loading }) => (
      <Button variant={props.variant ?? 'default'} disabled={loading} onClick={() => emit('press')} className="w-fit">
        {props.label}
      </Button>
    ),
    Input: ({ props, bindings }) => {
      const [value, setValue] = useControlProp(props.value, bindings?.value)
      return (
        <Label className="flex-col items-stretch gap-1.5 font-normal">
          <span>{props.label}</span>
          <Input
            type={props.type ?? 'text'}
            placeholder={props.placeholder}
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
          />
        </Label>
      )
    },
    Switch: ({ props, bindings }) => {
      const [checked, setChecked] = useControlProp(props.checked, bindings?.checked)
      return (
        <Label className="justify-between gap-3 font-normal">
          <span>{props.label}</span>
          <Switch checked={checked ?? false} onCheckedChange={(next: boolean) => setChecked(next)} />
        </Label>
      )
    },
    Choice: ({ props, bindings }) => {
      const [value, setValue] = useControlProp(props.value, bindings?.value)
      return (
        <div className="flex flex-col gap-1.5 text-sm">
          {props.label && <span>{props.label}</span>}
          <ToggleGroup
            variant="outline"
            size="sm"
            className="flex-wrap"
            value={value ? [value] : []}
            onValueChange={(next: Array<string>) => next[0] && setValue(next[0])}>
            {props.options.map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className="aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-foreground">
                {value === option && <IconCheck aria-hidden className="text-primary" />}
                {option}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )
    },
    Alert: ({ props }) => {
      const danger = props.tone === 'danger'
      const Icon = danger ? IconAlertTriangle : IconInfoCircle
      return (
        <Alert variant={danger ? 'destructive' : 'default'}>
          <Icon />
          <AlertTitle>{props.title}</AlertTitle>
          {props.description && <AlertDescription>{props.description}</AlertDescription>}
        </Alert>
      )
    },
    Tabs: ({ props, children }) => {
      const panels = React.Children.toArray(children)
      return (
        <Tabs defaultValue={0}>
          <TabsList className="max-w-full overflow-x-auto">
            {panels.map((_, i) => (
              <TabsTrigger key={i} value={i}>
                {props.labels[i] ?? copy[getLocale()].item(i + 1)}
              </TabsTrigger>
            ))}
          </TabsList>
          {panels.map((panel, i) => (
            <TabsContent key={i} value={i} className="flex flex-col gap-3 pt-2">
              {panel}
            </TabsContent>
          ))}
        </Tabs>
      )
    },
    Accordion: ({ children }) => <Accordion>{children}</Accordion>,
    AccordionItem: ({ props, children }) => (
      <AccordionItem>
        <AccordionTrigger>{props.title}</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">{children}</AccordionContent>
      </AccordionItem>
    ),
    Select: ({ props, bindings }) => {
      const [value, setValue] = useControlProp(props.value, bindings?.value)
      return (
        <div className="flex flex-col gap-1.5 text-sm">
          {props.label && <span>{props.label}</span>}
          <Select value={value ?? null} onValueChange={(next: string | null) => next && setValue(next)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder={props.placeholder ?? copy[getLocale()].choose} />
            </SelectTrigger>
            <SelectContent>
              {props.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    },
    Slider: ({ props, bindings }) => {
      const [value, setValue] = useControlProp(props.value, bindings?.value)
      const current = value ?? props.min
      return (
        <div className="flex flex-col gap-2.5 text-sm">
          <div className="flex justify-between">
            <span>{props.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {current}
              {props.unit && ` ${props.unit}`}
            </span>
          </div>
          <Slider
            min={props.min}
            max={props.max}
            step={props.step ?? 1}
            value={current}
            onValueChange={(next: number | ReadonlyArray<number>) => setValue(Array.isArray(next) ? next[0] : (next as number))}
          />
        </div>
      )
    },
    Checkbox: ({ props, bindings }) => {
      const [checked, setChecked] = useControlProp(props.checked, bindings?.checked)
      return (
        <Label className="font-normal">
          <Checkbox checked={checked ?? false} onCheckedChange={(next: boolean) => setChecked(next)} />
          <span>{props.label}</span>
        </Label>
      )
    },
  },
  actions: { ask: async () => {} },
})

type GenerativeUIProps = {
  patches: ReadonlyArray<unknown>
  streaming: boolean
  onAsk: (text: string) => void
}

export function GenerativeUI({ patches, streaming, onAsk }: GenerativeUIProps) {
  const complete = streaming ? patches.slice(0, -1) : patches
  const spec = React.useMemo(() => buildSpec(complete), [complete.length, streaming])

  const store = React.useMemo(() => createStateStore(), [])
  const seeded = React.useRef(false)
  React.useEffect(() => {
    if (seeded.current || !spec?.state) return
    for (const [key, value] of Object.entries(spec.state)) store.set(`/${key}`, value)
    if (!streaming) seeded.current = true
  }, [spec, streaming, store])

  const onAskRef = React.useRef(onAsk)
  onAskRef.current = onAsk
  const handlers = React.useMemo(
    () => ({
      ask: (params: Record<string, unknown>) => {
        if (typeof params.text === 'string' && params.text.trim()) onAskRef.current(params.text)
      },
    }),
    [],
  )

  if (!spec) return streaming ? <GenerativeUISkeleton /> : null

  return (
    <div className="w-full animate-in fade-in duration-150">
      <JSONUIProvider registry={registry} store={store} handlers={handlers}>
        <Renderer spec={spec} registry={registry} loading={streaming} />
      </JSONUIProvider>
    </div>
  )
}

function GenerativeUISkeleton() {
  const t = useMessages(copy)
  return (
    <div className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
      <IconSparkles className="size-4 animate-pulse" />
      {t.building}
    </div>
  )
}
