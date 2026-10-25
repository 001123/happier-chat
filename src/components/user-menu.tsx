import * as React from 'react'
import { Link, useRouteContext, useRouter } from '@tanstack/react-router'
import { Menu } from '@base-ui/react/menu'
import { cn } from 'cn'
import {
  IconAdjustments,
  IconCheck,
  IconChevronRight,
  IconContrast2,
  IconLanguage,
  IconLogout,
  IconPalette,
  IconSelector,
  IconSettings,
} from '@tabler/icons-react'

import { ThemeSwitcher, useColorMode } from '@/components/theme-toggle'
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar'
import { clearAccountData } from '@/lib/account-data'
import { applyThemePreset, isPresetActive, previewThemePreset, themePresets, useCustomColors } from '@/lib/custom-colors'
import { logout } from '@/server/auth.functions'
import { LOCALES, LOCALE_NAMES, defineMessages, isLocale, setLocale, useLocale, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: { account: 'Tài khoản', settings: 'Cài đặt', theme: 'Giao diện', themes: 'Chủ đề', customTheme: 'Tuỳ chỉnh', themeOptions: 'Tuỳ chọn', language: 'Ngôn ngữ', logout: 'Đăng xuất', confirmTitle: 'Đăng xuất?', confirmHint: 'Bạn sẽ cần đăng nhập lại để tiếp tục.', cancel: 'Huỷ' },
  en: { account: 'Account', settings: 'Settings', theme: 'Appearance', themes: 'Themes', customTheme: 'Custom', themeOptions: 'Customize', language: 'Language', logout: 'Log out', confirmTitle: 'Log out?', confirmHint: "You'll need to sign in again to continue.", cancel: 'Cancel' },
})

const menuItem =
  'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&>svg]:size-4 [&>svg]:text-muted-foreground'

export function UserMenu() {
  const t = useMessages(messages)
  const { user } = useRouteContext({ from: '/_app' })
  const { state, isMobile } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  const [confirming, setConfirming] = React.useState(false)

  async function onLogout() {
    await logout()
    clearAccountData()
    // A full load drops every in-memory store, so the next account starts clean.
    window.location.replace('/login')
  }

  return (
    <Menu.Root onOpenChange={(open) => !open && setConfirming(false)}>
      <Menu.Trigger
        openOnHover
        delay={100}
        closeDelay={200}
        render={
          <SidebarMenuButton
            size="lg"
            aria-label={t.account}
            className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
          />
        }
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground uppercase">
          {(user.name || user.email).charAt(0)}
        </span>
        <span className="min-w-0 flex-1 truncate">{user.name || user.email}</span>
        <IconSelector className="ml-auto text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="isolate z-50"
          side={collapsed ? 'right' : 'top'}
          align={collapsed ? 'end' : 'start'}
          sideOffset={6}
        >
          <Menu.Popup className="w-(--anchor-width) min-w-60 origin-(--transform-origin) rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Menu.LinkItem className={menuItem} closeOnClick render={<Link to="/settings" />}>
              <IconSettings />
              {t.settings}
            </Menu.LinkItem>
            <div className="flex items-center gap-2 px-2 py-1 [&>svg]:size-4 [&>svg]:text-muted-foreground">
              <IconContrast2 />
              <span className="flex-1">{t.theme}</span>
              <ThemeSwitcher />
            </div>
            <ThemeSubmenu label={t.themes} customLabel={t.customTheme} optionsLabel={t.themeOptions} />
            <LanguageSubmenu label={t.language} />
            <Menu.Separator className="-mx-1 my-1 h-px bg-border" />
            {confirming ? (
              <div className="flex flex-col px-2 pt-1.5 pb-1">
                <span className="font-medium">{t.confirmTitle}</span>
                <span className="text-xs text-muted-foreground">{t.confirmHint}</span>
                <div className="mt-2 flex gap-1.5">
                  <Menu.Item
                    closeOnClick={false}
                    onClick={() => setConfirming(false)}
                    className={cn(menuItem, 'h-7 flex-1 justify-center py-0 whitespace-nowrap border')}
                  >
                    {t.cancel}
                  </Menu.Item>
                  <Menu.Item
                    onClick={onLogout}
                    className={cn(
                      menuItem,
                      'h-7 flex-1 justify-center py-0 font-medium whitespace-nowrap bg-destructive/10 text-destructive data-highlighted:bg-destructive/20 data-highlighted:text-destructive [&>svg]:text-destructive',
                    )}
                  >
                    {t.logout}
                  </Menu.Item>
                </div>
              </div>
            ) : (
              <Menu.Item className={menuItem} closeOnClick={false} onClick={() => setConfirming(true)}>
                <IconLogout />
                {t.logout}
              </Menu.Item>
            )}
            <div className="px-2 pt-1 pb-0.5 text-xs text-muted-foreground/70 tabular-nums">
              v{__APP_VERSION__}
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function ThemeSubmenu({ label, customLabel, optionsLabel }: { label: string; customLabel: string; optionsLabel: string }) {
  const locale = useLocale()
  const mode = useColorMode()
  const colors = useCustomColors()
  const active = themePresets.find((preset) => isPresetActive(preset, colors, mode))

  function changePreset(next: unknown) {
    const preset = themePresets.find((p) => p.id === next)
    if (preset && preset !== active) applyThemePreset(preset)
  }

  // Never leave an unsaved preview painted once the menu goes away.
  React.useEffect(() => () => previewThemePreset(null), [])

  return (
    <Menu.SubmenuRoot onOpenChange={(open) => !open && previewThemePreset(null)}>
      <Menu.SubmenuTrigger className={cn(menuItem, 'data-popup-open:bg-accent')}>
        <IconPalette />
        <span className="flex-1">{label}</span>
        <span className="max-w-28 truncate text-xs text-muted-foreground">{active ? active.name[locale] : customLabel}</span>
        <IconChevronRight />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner side="right" align="start" sideOffset={4} alignOffset={-4} collisionPadding={8} className="isolate z-50">
          <Menu.Popup
            onPointerLeave={() => previewThemePreset(null)}
            className="max-h-(--available-height) min-w-48 origin-(--transform-origin) overflow-y-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Menu.RadioGroup value={active?.id ?? null} onValueChange={changePreset}>
              {themePresets.map((preset) => (
                <Menu.RadioItem
                  key={preset.id}
                  value={preset.id}
                  closeOnClick={false}
                  onPointerEnter={() => previewThemePreset(preset)}
                  onFocus={() => previewThemePreset(preset)}
                  className={menuItem}
                >
                  <span className="flex size-4 items-center justify-center">
                    <Menu.RadioItemIndicator>
                      <IconCheck className="size-4" />
                    </Menu.RadioItemIndicator>
                  </span>
                  <span
                    aria-hidden
                    className="flex size-4 shrink-0 items-center justify-center rounded-full border"
                    style={{ backgroundColor: preset[mode].background, borderColor: preset[mode].border }}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: preset[mode].primary }} />
                  </span>
                  <span className="flex-1">{preset.name[locale]}</span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
            <Menu.Separator className="-mx-1 my-1 h-px bg-border" />
            <Menu.LinkItem
              closeOnClick
              onPointerEnter={() => previewThemePreset(null)}
              onFocus={() => previewThemePreset(null)}
              className={menuItem}
              render={<Link to="/settings/appearance" />}
            >
              <IconAdjustments />
              {optionsLabel}
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  )
}

function LanguageSubmenu({ label }: { label: string }) {
  const router = useRouter()
  const locale = useLocale()

  function changeLocale(next: unknown) {
    if (!isLocale(next) || next === locale) return
    setLocale(next)
    // Re-run `head()` so the tab title follows the new language.
    void router.invalidate()
  }

  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger className={cn(menuItem, 'data-popup-open:bg-accent')}>
        <IconLanguage />
        <span className="flex-1">{label}</span>
        <span className="text-xs text-muted-foreground">{LOCALE_NAMES[locale]}</span>
        <IconChevronRight />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner side="right" align="start" sideOffset={4} alignOffset={-4} collisionPadding={8} className="isolate z-50">
          <Menu.Popup className="min-w-40 origin-(--transform-origin) rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Menu.RadioGroup value={locale} onValueChange={changeLocale}>
              {LOCALES.map((l) => (
                <Menu.RadioItem key={l} value={l} lang={l} closeOnClick={false} className={menuItem}>
                  <span className="flex size-4 items-center justify-center">
                    <Menu.RadioItemIndicator>
                      <IconCheck className="size-4" />
                    </Menu.RadioItemIndicator>
                  </span>
                  {LOCALE_NAMES[l]}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  )
}
