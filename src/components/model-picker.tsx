import { Link } from '@tanstack/react-router'
import { Menu } from '@base-ui/react/menu'
import { IconCheck, IconChevronDown, IconPlus, IconSettings } from '@tabler/icons-react'

import { itemClass, popupClass } from '@/components/composer-settings-menu'
import { InputGroupButton, InputGroupText } from '@/components/ui/input-group'
import { setChatSetting } from '@/lib/chat-settings'
import { formatPrice, formatTokens } from '@/lib/model-catalog'
import type { CatalogModel } from '@/lib/model-catalog'
import { useActiveModel, useModelOptions, useProviders } from '@/lib/provider-store'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: { addProvider: 'Thêm API key', manageProviders: 'Quản lý cấu hình AI' },
  en: { addProvider: 'Add provider', manageProviders: 'Manage providers' },
})

export function ModelPicker() {
  const t = useMessages(messages)
  const { loaded } = useProviders()
  const options = useModelOptions()
  const active = useActiveModel()

  if (!loaded) return <InputGroupText className="text-xs" />
  if (!active) {
    return (
      <InputGroupButton
        size="xs"
        className="text-xs text-muted-foreground"
        nativeButton={false}
        render={<Link to="/settings/providers" />}
      >
        <IconPlus />
        {t.addProvider}
      </InputGroupButton>
    )
  }

  const groups = new Map<string, typeof options>()
  for (const option of options) groups.set(option.providerId, [...(groups.get(option.providerId) ?? []), option])

  return (
    <Menu.Root>
      <Menu.Trigger
        render={<InputGroupButton type="button" size="xs" />}
        className="max-w-48 text-xs text-muted-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
        title={active.info ? `${active.info.name} · ${describeModel(active.info)}` : undefined}
      >
        <span className="truncate">{active.modelId}</span>
        <IconChevronDown />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={6} collisionPadding={8} className="z-50">
          <Menu.Popup className={`${popupClass} max-h-96 max-w-80 overflow-y-auto`}>
            <Menu.RadioGroup value={active.key} onValueChange={(key: string) => setChatSetting('model', key)}>
              {[...groups.values()].map((models, i) => (
                <Menu.Group key={models[0]!.providerId}>
                  {i > 0 && <Menu.Separator className="-mx-1 my-1 h-px bg-border" />}
                  {groups.size > 1 && (
                    <Menu.GroupLabel className="px-2 py-1 text-xs text-muted-foreground">
                      {models[0]!.providerName}
                    </Menu.GroupLabel>
                  )}
                  {models.map((option) => (
                    <Menu.RadioItem
                      key={option.key}
                      value={option.key}
                      closeOnClick
                      className={option.info ? `${itemClass} h-auto py-1.5` : itemClass}
                    >
                      <span className="flex size-4 items-center justify-center">
                        <Menu.RadioItemIndicator>
                          <IconCheck />
                        </Menu.RadioItemIndicator>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{option.modelId}</span>
                        {option.info && (
                          <span className="truncate text-xs text-muted-foreground">{describeModel(option.info)}</span>
                        )}
                      </span>
                    </Menu.RadioItem>
                  ))}
                </Menu.Group>
              ))}
            </Menu.RadioGroup>
            <Menu.Separator className="-mx-1 my-1 h-px bg-border" />
            <Menu.LinkItem render={<Link to="/settings/providers" />} className={itemClass}>
              <IconSettings />
              {t.manageProviders}
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

/** One line of what a model can do and costs: context, price per 1M tokens in/out, capabilities. */
function describeModel(info: CatalogModel) {
  const parts = [`${formatTokens(info.context)} context`]
  if (info.cost?.input != null || info.cost?.output != null) {
    parts.push(`${formatPrice(info.cost.input)}/${formatPrice(info.cost.output)}`)
  }
  if (info.reasoning) parts.push('reasoning')
  if (info.input.includes('image')) parts.push('vision')
  return parts.join(' · ')
}
