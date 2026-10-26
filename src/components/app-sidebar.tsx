import * as React from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Menu } from '@base-ui/react/menu'
import { useHotkey } from '@tanstack/react-hotkeys'
import { cn } from 'cn'
import {
  IconArchive,
  IconArchiveOff,
  IconArrowsSort,
  IconCheck,
  IconChevronRight,
  IconDots,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconListCheck,
  IconMessage,
  IconMinus,
  IconPencil,
  IconPlus,
  IconScript,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react'

import { Logo } from '@/components/logo'
import { appHotkeys, useShortcutLabel, withShortcut } from '@/lib/shortcuts'
import { VirtualMenuItems } from '@/components/virtual-menu-items'
import type { RowProps } from '@/components/virtual-menu-items'
import { ProjectInstructionsDialog } from '@/components/project-instructions-dialog'
import { UserMenu } from '@/components/user-menu'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  createProject,
  deleteProject,
  renameProject,
  setProjectCollapsed,
  useProjects,
} from '@/lib/projects'
import {
  deleteThreads,
  moveThread,
  newThreadInProject,
  pendingProject,
  renameThread,
  setThreadsArchived,
  useArchivedThreads,
  useLiveThreads,
  useThreadBusy,
} from '@/lib/threads'
import type { Thread, ThreadSort } from '@/lib/threads'
import { defineMessages, useMessages } from '@/lib/i18n'

/** Pencil over an open rounded square: the "compose" mark people know from ChatGPT. */
function ComposeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4" />
      <path d="M18.4 3.6a2.1 2.1 0 0 1 3 3L13 15l-4 1 1-4z" />
    </svg>
  )
}

const messages = defineMessages({
  vi: {
    sortNewest: 'Mới nhất',
    sortOldest: 'Cũ nhất',
    sortAz: 'Tên A → Z',
    sortZa: 'Tên Z → A',
    projectName: 'Tên dự án',
    threadName: 'Tên cuộc trò chuyện',
    selected: (n: number) => `Đã chọn ${n}`,
    selectAll: 'Chọn tất cả',
    deleteSelected: 'Xoá các mục đã chọn',
    unarchiveSelected: 'Bỏ lưu trữ các mục đã chọn',
    archiveSelected: 'Lưu trữ các mục đã chọn',
    exitSelect: 'Thoát chế độ chọn',
    select: 'Chọn nhiều',
    rename: 'Đổi tên',
    renameThread: 'Đổi tên cuộc trò chuyện',
    unarchive: 'Bỏ lưu trữ',
    archive: 'Lưu trữ',
    unarchiveThread: 'Bỏ lưu trữ cuộc trò chuyện',
    archiveThread: 'Lưu trữ cuộc trò chuyện',
    delete: 'Xoá',
    deleteThread: 'Xoá cuộc trò chuyện',
    confirmDelete: 'Bấm lần nữa để xoá',
    newChat: 'Cuộc trò chuyện mới',
    searchPlaceholder: 'Tìm cuộc trò chuyện',
    searchLabel: 'Tìm cuộc trò chuyện theo tên',
    clearSearch: 'Xoá từ khoá',
    projects: 'Dự án',
    newProject: 'Dự án mới',
    projectsEmpty: 'Tạo dự án rồi kéo cuộc trò chuyện vào để sắp xếp.',
    newChatInProject: 'Trò chuyện mới trong dự án',
    projectOptions: 'Tuỳ chọn dự án',
    newChatItem: 'Trò chuyện mới',
    projectInstructions: 'Hướng dẫn dự án',
    deleteProject: 'Xoá dự án',
    dragHere: 'Kéo cuộc trò chuyện vào đây hoặc bấm',
    createNew: 'tạo mới',
    recents: 'Gần đây',
    sort: 'Sắp xếp',
    sortBy: 'Sắp xếp theo',
    sortTitle: (label: string) => `Sắp xếp: ${label}`,
    noResultsOutside: 'Không có kết quả ngoài dự án.',
    onlyArchivedResults: 'Chỉ có kết quả trong mục lưu trữ.',
    noMatch: 'Không tìm thấy cuộc trò chuyện nào.',
    noThreads: 'Chưa có cuộc trò chuyện nào.',
    allInProjects: 'Mọi cuộc trò chuyện đã nằm trong dự án.',
    archived: 'Đã lưu trữ',
    dragToArchive: 'Kéo cuộc trò chuyện vào đây để lưu trữ.',
    confirmTitle: (n: number) => `Xoá ${n} cuộc trò chuyện?`,
    confirmBody: 'Tin nhắn trong các cuộc trò chuyện này sẽ bị xoá vĩnh viễn và không thể khôi phục.',
    cancel: 'Huỷ',
    replying: 'Đang trả lời',
  },
  en: {
    sortNewest: 'Newest',
    sortOldest: 'Oldest',
    sortAz: 'Name A → Z',
    sortZa: 'Name Z → A',
    projectName: 'Project name',
    threadName: 'Conversation name',
    selected: (n: number) => `${n} selected`,
    selectAll: 'Select all',
    deleteSelected: 'Delete selected items',
    unarchiveSelected: 'Unarchive selected items',
    archiveSelected: 'Archive selected items',
    exitSelect: 'Exit selection mode',
    select: 'Select multiple',
    rename: 'Rename',
    renameThread: 'Rename conversation',
    unarchive: 'Unarchive',
    archive: 'Archive',
    unarchiveThread: 'Unarchive conversation',
    archiveThread: 'Archive conversation',
    delete: 'Delete',
    deleteThread: 'Delete conversation',
    confirmDelete: 'Click again to delete',
    newChat: 'New chat',
    searchPlaceholder: 'Search conversations',
    searchLabel: 'Search conversations by name',
    clearSearch: 'Clear search',
    projects: 'Projects',
    newProject: 'New project',
    projectsEmpty: 'Create a project, then drag conversations into it to organize them.',
    newChatInProject: 'New chat in project',
    projectOptions: 'Project options',
    newChatItem: 'New chat',
    projectInstructions: 'Project instructions',
    deleteProject: 'Delete project',
    dragHere: 'Drag a conversation here or',
    createNew: 'create new',
    recents: 'Recents',
    sort: 'Sort',
    sortBy: 'Sort by',
    sortTitle: (label: string) => `Sort: ${label}`,
    noResultsOutside: 'No results outside projects.',
    onlyArchivedResults: 'Results only in archived.',
    noMatch: 'No conversations found.',
    noThreads: 'No conversations yet.',
    allInProjects: 'All conversations are in projects.',
    archived: 'Archived',
    dragToArchive: 'Drag a conversation here to archive it.',
    confirmTitle: (n: number) => `Delete ${n} ${n === 1 ? 'conversation' : 'conversations'}?`,
    confirmBody: 'Messages in these conversations will be permanently deleted and cannot be recovered.',
    cancel: 'Cancel',
    replying: 'Replying',
  },
})

const SORT_KEYS = ['newest', 'oldest', 'az', 'za'] as const satisfies ReadonlyArray<ThreadSort>
type SortKey = ThreadSort
const SORT_KEY = 'chat-threads-sort'
const SKELETON_WIDTHS = ['72%', '58%', '84%', '64%', '76%']

// Case- and diacritic-insensitive, so "sai gon" matches "Sài Gòn".
const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase()

const RECENTS = '__recents__'
const ARCHIVED = '__archived__'
const ARCHIVED_OPEN_KEY = 'chat-archived-open'
const DRAG_TYPE = 'application/x-thread-id'

const menuPopup =
  'min-w-40 origin-(--transform-origin) rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'
const menuItem =
  'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&>svg]:size-3.5'

const iconButton =
  'flex size-6 items-center justify-center rounded-md text-sidebar-foreground/70 outline-hidden ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40 [&>svg]:size-3.5'

function CheckMark({ state }: { state: boolean | 'mixed' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-sidebar-foreground/40 transition-colors',
        state && 'border-primary bg-primary text-primary-foreground',
      )}
    >
      {state === 'mixed' ? (
        <IconMinus className="size-3" />
      ) : state ? (
        <IconCheck className="size-3" />
      ) : null}
    </span>
  )
}

function TruncatedTitle({ text }: { text: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [open, setOpen] = React.useState(false)
  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        const el = ref.current
        setOpen(next && !!el && el.scrollWidth > el.clientWidth)
      }}
    >
      <TooltipTrigger delay={400} render={<span ref={ref} />}>
        {text}
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={8}
        anchor={() => ref.current?.closest('[data-sidebar=menu-item]') ?? null}
        className="break-words"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function NameInput({
  initial = '',
  icon: Icon = IconFolder,
  label,
  onSubmit,
  onCancel,
}: {
  initial?: string
  icon?: React.ComponentType<{ className?: string }>
  label?: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const t = useMessages(messages)
  label ??= t.projectName
  const done = React.useRef(false)
  const finish = (value: string) => {
    if (done.current) return
    done.current = true
    const name = value.trim()
    if (name) onSubmit(name)
    else onCancel()
  }
  return (
    <div className="flex h-8 items-center gap-2 rounded-md px-2 ring-2 ring-sidebar-ring">
      <Icon className="size-4 shrink-0 text-sidebar-foreground/70" />
      <input
        autoFocus
        defaultValue={initial}
        placeholder={label}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => finish(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(e.currentTarget.value)
          if (e.key === 'Escape') {
            done.current = true
            onCancel()
          }
        }}
      />
    </div>
  )
}

export function AppSidebar() {
  const t = useMessages(messages)
  const sortLabels = { newest: t.sortNewest, oldest: t.sortOldest, az: t.sortAz, za: t.sortZa }
  const projects = useProjects()
  const navigate = useNavigate()
  const { threadId } = useParams({ strict: false })
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const [sort, setSort] = React.useState<SortKey>('newest')
  React.useEffect(() => {
    const saved = localStorage.getItem(SORT_KEY)
    if (SORT_KEYS.includes(saved as SortKey)) setSort(saved as SortKey)
  }, [])
  const changeSort = (value: SortKey) => {
    setSort(value)
    localStorage.setItem(SORT_KEY, value)
  }
  // Sorting and the archived split happen in live queries; only the diacritic-insensitive search runs here.
  const liveAll = useLiveThreads(sort)
  const archivedAll = useArchivedThreads(sort)
  const [query, setQuery] = React.useState('')
  const needle = normalize(query.trim())
  const searching = needle !== ''
  const live = React.useMemo(
    () => (needle ? liveAll.filter((t) => normalize(t.title).includes(needle)) : liveAll),
    [liveAll, needle],
  )
  const archived = React.useMemo(
    () => (needle ? archivedAll.filter((t) => normalize(t.title).includes(needle)) : archivedAll),
    [archivedAll, needle],
  )
  const threads = React.useMemo(() => [...liveAll, ...archivedAll], [liveAll, archivedAll])
  const projectIds = React.useMemo(() => new Set(projects.map((p) => p.id)), [projects])
  const liveCount = liveAll.length
  const ungrouped = live.filter((t) => !t.projectId || !projectIds.has(t.projectId))
  const byProject = React.useMemo(() => {
    const map = new Map<string, Array<Thread>>()
    for (const t of live) {
      if (!t.projectId) continue
      const list = map.get(t.projectId)
      if (list) list.push(t)
      else map.set(t.projectId, [t])
    }
    return map
  }, [live])

  const [creatingProject, setCreatingProject] = React.useState(false)
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [instructionsId, setInstructionsId] = React.useState<string | null>(null)
  const [renamingThreadId, setRenamingThreadId] = React.useState<string | null>(null)

  const [dragId, setDragId] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<string | null>(null)
  const dragged = dragId ? threads.find((t) => t.id === dragId) : undefined
  const draggedProject = dragged?.projectId && projectIds.has(dragged.projectId) ? dragged.projectId : RECENTS
  const endDrag = () => {
    setDragId(null)
    setDropTarget(null)
  }
  const dropZone = (target: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId || target === draggedProject) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dropTarget !== target) setDropTarget(target)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setDropTarget((cur) => (cur === target ? null : cur))
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const id = e.dataTransfer.getData(DRAG_TYPE) || dragId
      if (id && target === ARCHIVED) setThreadsArchived([id], true)
      else if (id) {
        moveThread(id, target === RECENTS ? null : target)
        if (target !== RECENTS) setProjectCollapsed(target, false)
      }
      endDrag()
    },
  })

  const [archivedOpen, setArchivedOpen] = React.useState(false)
  React.useEffect(() => {
    setArchivedOpen(localStorage.getItem(ARCHIVED_OPEN_KEY) === '1')
  }, [])
  const toggleArchived = () => {
    const next = !archivedOpen
    setArchivedOpen(next)
    localStorage.setItem(ARCHIVED_OPEN_KEY, next ? '1' : '0')
  }
  const showArchived = archivedOpen || (searching && archived.length > 0)

  // Multi-select is scoped to one list: Recents, Archived, or a single project id.
  const [selectScope, setSelectScope] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const activeScope =
    selectScope === RECENTS ||
    (selectScope === ARCHIVED && showArchived) ||
    (selectScope && projectIds.has(selectScope))
      ? selectScope
      : null
  const selecting = activeScope !== null
  const scopeThreads =
    activeScope === null
      ? []
      : activeScope === RECENTS
        ? ungrouped
        : activeScope === ARCHIVED
          ? archived
          : byProject.get(activeScope) ?? []
  const selectedThreads = scopeThreads.filter((t) => selected.has(t.id))
  const selectedCount = selectedThreads.length
  const allState: boolean | 'mixed' =
    selectedCount === 0 ? false : selectedCount === scopeThreads.length ? true : 'mixed'

  const startSelecting = (scope: string) => {
    setSelectScope(scope)
    setSelected(new Set())
    if (scope !== RECENTS && scope !== ARCHIVED) setProjectCollapsed(scope, false)
  }
  const exitSelecting = () => {
    setSelectScope(null)
    setSelected(new Set())
  }
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const toggleAll = () =>
    setSelected(allState === true ? new Set() : new Set(scopeThreads.map((t) => t.id)))
  const [confirming, setConfirming] = React.useState(false)
  // Kept separately from `confirming` so the list stays rendered during the close animation.
  const [deleteTargets, setDeleteTargets] = React.useState<ReadonlyArray<Thread>>([])
  const requestDelete = (targets: ReadonlyArray<Thread>) => {
    if (targets.length === 0) return
    setDeleteTargets(targets)
    setConfirming(true)
  }
  const confirmDelete = () => {
    const ids = deleteTargets.map((t) => t.id)
    setConfirming(false)
    if (ids.length === 0) return
    deleteThreads(ids)
    if (threadId && ids.includes(threadId)) void navigate({ to: '/' })
    if (selectScope) exitSelecting()
  }
  // Single-thread delete confirms inline: the first click arms the button, the second deletes.
  const [armedDeleteId, setArmedDeleteId] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!armedDeleteId) return
    const timer = setTimeout(() => setArmedDeleteId(null), 3000)
    return () => clearTimeout(timer)
  }, [armedDeleteId])
  const deleteOne = (thread: Thread) => {
    if (armedDeleteId !== thread.id) return setArmedDeleteId(thread.id)
    setArmedDeleteId(null)
    deleteThreads([thread.id])
    if (thread.id === threadId) void navigate({ to: '/' })
  }
  const archiveSelected = () => {
    setThreadsArchived(
      selectedThreads.map((t) => t.id),
      activeScope !== ARCHIVED,
    )
    exitSelecting()
  }

  const { isMobile, setOpenMobile, setOpen } = useSidebar()
  // Any navigation from the sidebar should reveal the page on mobile.
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [threadId, isMobile, setOpenMobile])

  // A thread that is not saved yet and not bound to a project is already a blank new chat.
  // Starting another one would only throw away the draft, so focus the composer instead.
  const onBlankChat = !!threadId && !pendingProject(threadId) && !threads.some((t) => t.id === threadId)
  const newChat = () => {
    if (onBlankChat) {
      document.querySelector<HTMLTextAreaElement>('[data-composer]')?.focus()
      if (isMobile) setOpenMobile(false)
      return
    }
    void navigate({ to: '/' })
  }

  const searchRef = React.useRef<HTMLInputElement>(null)
  useHotkey(appHotkeys['chat.new'], newChat)
  useHotkey(
    appHotkeys['threads.search'],
    () => {
      // The search box is not rendered while the sidebar is collapsed to icons.
      if (isMobile) setOpenMobile(true)
      else setOpen(true)
      requestAnimationFrame(() => {
        searchRef.current?.focus()
        searchRef.current?.select()
      })
    },
  )
  const newChatShortcut = useShortcutLabel('chat.new')
  const searchShortcut = useShortcutLabel('threads.search')

  const newChatIn = (projectId: string) => {
    setProjectCollapsed(projectId, false)
    void navigate({ to: '/chat/$threadId', params: { threadId: newThreadInProject(projectId) } })
  }

  const renderSelectBar = (onExit?: () => void) => (
    <div className="mb-1 flex items-center gap-2 rounded-md px-2 py-1 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
      <button
        type="button"
        role="checkbox"
        aria-checked={allState}
        className="flex flex-1 items-center gap-2 rounded-md text-left outline-hidden focus-visible:ring-2 ring-sidebar-ring"
        onClick={toggleAll}
      >
        <CheckMark state={allState} />
        <span className="text-sidebar-foreground/80">
          {selectedCount > 0 ? t.selected(selectedCount) : t.selectAll}
        </span>
      </button>
      <button
        type="button"
        className={cn(iconButton, 'hover:bg-destructive/10 hover:text-destructive')}
        aria-label={t.deleteSelected}
        title={t.deleteSelected}
        disabled={selectedCount === 0}
        onClick={() => requestDelete(selectedThreads)}
      >
        <IconTrash />
      </button>
      <button
        type="button"
        className={iconButton}
        aria-label={activeScope === ARCHIVED ? t.unarchiveSelected : t.archiveSelected}
        title={activeScope === ARCHIVED ? t.unarchiveSelected : t.archiveSelected}
        disabled={selectedCount === 0}
        onClick={archiveSelected}
      >
        {activeScope === ARCHIVED ? <IconArchiveOff /> : <IconArchive />}
      </button>
      {onExit && (
        <button
          type="button"
          className={iconButton}
          aria-label={t.exitSelect}
          title={t.exitSelect}
          onClick={onExit}
        >
          <IconX />
        </button>
      )}
    </div>
  )

  const renderThread = (thread: Thread, scope: string, rowProps?: RowProps) => {
    const checkable = activeScope === scope
    return (
      <SidebarMenuItem
        key={thread.id}
        {...rowProps}
        draggable={!selecting && !thread.archived && renamingThreadId !== thread.id}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, thread.id)
          e.dataTransfer.effectAllowed = 'move'
          setDragId(thread.id)
        }}
        onDragEnd={endDrag}
        onMouseLeave={() => armedDeleteId === thread.id && setArmedDeleteId(null)}
        className={cn(
          'animate-in fade-in slide-in-from-left-2 duration-150',
          dragId === thread.id && 'opacity-40',
        )}
      >
        {renamingThreadId === thread.id ? (
          <NameInput
            initial={thread.title}
            icon={IconMessage}
            label={t.threadName}
            onSubmit={(name) => {
              if (name !== thread.title) renameThread(thread.id, name)
              setRenamingThreadId(null)
            }}
            onCancel={() => setRenamingThreadId(null)}
          />
        ) : checkable ? (
          <SidebarMenuButton
            role="checkbox"
            aria-checked={selected.has(thread.id)}
            isActive={selected.has(thread.id)}
            onClick={() => toggleOne(thread.id)}
          >
            <CheckMark state={selected.has(thread.id)} />
            <span>{thread.title}</span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton
            isActive={thread.id === threadId}
            render={<Link to="/chat/$threadId" params={{ threadId: thread.id }} />}
            onDoubleClick={() => setRenamingThreadId(thread.id)}
            className="group-focus-within/menu-item:pr-20! group-hover/menu-item:pr-20!"
          >
            <ThreadIcon id={thread.id} />
            <TruncatedTitle text={thread.title} />
          </SidebarMenuButton>
        )}
        {!checkable && renamingThreadId !== thread.id && (
          <SidebarMenuAction
            showOnHover
            aria-label={t.renameThread}
            title={t.rename}
            className="right-13"
            onClick={() => setRenamingThreadId(thread.id)}
          >
            <IconPencil />
          </SidebarMenuAction>
        )}
        {!checkable && renamingThreadId !== thread.id && (
          <SidebarMenuAction
            showOnHover
            aria-label={thread.archived ? t.unarchiveThread : t.archiveThread}
            title={thread.archived ? t.unarchive : t.archive}
            className="right-7"
            onClick={() => setThreadsArchived([thread.id], !thread.archived)}
          >
            {thread.archived ? <IconArchiveOff /> : <IconArchive />}
          </SidebarMenuAction>
        )}
        {!checkable && renamingThreadId !== thread.id && (
          <SidebarMenuAction
            showOnHover
            aria-label={armedDeleteId === thread.id ? t.confirmDelete : t.deleteThread}
            title={armedDeleteId === thread.id ? t.confirmDelete : t.delete}
            className={cn(
              armedDeleteId === thread.id &&
                'bg-destructive/10 text-destructive! opacity-100 hover:bg-destructive/15',
            )}
            onClick={() => deleteOne(thread)}
            onBlur={() => armedDeleteId === thread.id && setArmedDeleteId(null)}
          >
            {armedDeleteId === thread.id ? <IconCheck /> : <IconTrash />}
          </SidebarMenuAction>
        )}
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/" />}
              tooltip="Happier Chat"
              className="group/logo gap-2.5 group-data-[collapsible=icon]:justify-center"
            >
              <Logo className="size-6! group-data-[collapsible=icon]:size-5!" />
              <span className="font-serif text-lg leading-none font-medium tracking-tight group-data-[collapsible=icon]:hidden">
                Happier Chat
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link
                  to="/"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                    e.preventDefault()
                    newChat()
                  }}
                />
              }
              tooltip={withShortcut(t.newChat, newChatShortcut)}
            >
              <ComposeIcon className="text-primary" />
              <span className="font-medium">{t.newChat}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="relative group-data-[collapsible=icon]:hidden">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('')
            }}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
            title={withShortcut(t.searchLabel, searchShortcut)}
            className="h-8 w-full rounded-md border border-sidebar-border bg-background/60 pr-7 pl-8 text-sm outline-hidden placeholder:text-sidebar-foreground/50 focus-visible:ring-2 focus-visible:ring-sidebar-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label={t.clearSearch}
              title={t.clearSearch}
              onClick={() => setQuery('')}
            >
              <IconX className="size-3.5" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup
          className={cn(
            'group-data-[collapsible=icon]:hidden',
            searching && !creatingProject && !projects.some((p) => byProject.has(p.id)) && 'hidden',
          )}
        >
          <div className="flex items-center gap-0.5 pr-1">
            <SidebarGroupLabel className="flex-1">{t.projects}</SidebarGroupLabel>
            <button
              type="button"
              className={iconButton}
              aria-label={t.newProject}
              title={t.newProject}
              onClick={() => setCreatingProject(true)}
            >
              <IconFolderPlus />
            </button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {creatingProject && (
                <li>
                  <NameInput
                    onSubmit={(name) => {
                      createProject(name)
                      setCreatingProject(false)
                    }}
                    onCancel={() => setCreatingProject(false)}
                  />
                </li>
              )}
              {mounted && projects.length === 0 && !creatingProject && !searching && (
                <p className="px-2 py-1 text-sm text-muted-foreground">
                  {t.projectsEmpty}
                </p>
              )}
              {projects.map((project) => {
                const items = byProject.get(project.id) ?? []
                if (searching && items.length === 0) return null
                const open = searching || !project.collapsed
                const isDrop = dropTarget === project.id
                return (
                  <li key={project.id} className="rounded-md" {...dropZone(project.id)}>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        {renamingId === project.id ? (
                          <NameInput
                            initial={project.name}
                            onSubmit={(name) => {
                              renameProject(project.id, name)
                              setRenamingId(null)
                            }}
                            onCancel={() => setRenamingId(null)}
                          />
                        ) : (
                          <>
                            <SidebarMenuButton
                              aria-expanded={open}
                              onClick={() => setProjectCollapsed(project.id, open)}
                              className={cn(
                                'transition-colors group-focus-within/menu-item:pr-14 group-hover/menu-item:pr-14',
                                isDrop && 'bg-primary/10 text-primary ring-2 ring-primary/50',
                              )}
                            >
                              {open || isDrop ? <IconFolderOpen /> : <IconFolder />}
                              <span className="flex-1">{project.name}</span>
                              <IconChevronRight
                                className={cn(
                                  'size-3.5! text-sidebar-foreground/50 transition-transform group-hover/menu-item:opacity-0',
                                  open && 'rotate-90',
                                )}
                              />
                            </SidebarMenuButton>
                            <SidebarMenuAction
                              showOnHover
                              aria-label={t.newChatInProject}
                              title={t.newChatInProject}
                              className="right-7"
                              onClick={() => newChatIn(project.id)}
                            >
                              <IconPlus />
                            </SidebarMenuAction>
                            <Menu.Root>
                              <Menu.Trigger
                                render={<SidebarMenuAction showOnHover aria-label={t.projectOptions} />}
                              >
                                <IconDots />
                              </Menu.Trigger>
                              <Menu.Portal>
                                <Menu.Positioner className="isolate z-50" side="right" align="start" sideOffset={4}>
                                  <Menu.Popup className={menuPopup}>
                                    <Menu.Item className={menuItem} onClick={() => newChatIn(project.id)}>
                                      <IconPlus />
                                      {t.newChatItem}
                                    </Menu.Item>
                                    <Menu.Item className={menuItem} onClick={() => setRenamingId(project.id)}>
                                      <IconPencil />
                                      {t.rename}
                                    </Menu.Item>
                                    <Menu.Item className={menuItem} onClick={() => setInstructionsId(project.id)}>
                                      <IconScript />
                                      {t.projectInstructions}
                                    </Menu.Item>
                                    <Menu.Item
                                      className={menuItem}
                                      disabled={items.length === 0}
                                      onClick={() => startSelecting(project.id)}
                                    >
                                      <IconListCheck />
                                      {t.select}
                                    </Menu.Item>
                                    <Menu.Item
                                      className={cn(menuItem, 'text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive')}
                                      onClick={() => deleteProject(project.id)}
                                    >
                                      <IconTrash />
                                      {t.deleteProject}
                                    </Menu.Item>
                                  </Menu.Popup>
                                </Menu.Positioner>
                              </Menu.Portal>
                            </Menu.Root>
                          </>
                        )}
                      </SidebarMenuItem>
                    </SidebarMenu>
                    {open && activeScope === project.id && items.length > 0 && (
                      <div className="mt-1">{renderSelectBar(exitSelecting)}</div>
                    )}
                    {open && (
                      <SidebarMenuSub className="mr-0 pr-0 animate-in fade-in slide-in-from-top-1 duration-150">
                        {items.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-muted-foreground">
                            {t.dragHere}{' '}
                            <button
                              type="button"
                              className="font-medium text-sidebar-foreground underline-offset-2 hover:underline"
                              onClick={() => newChatIn(project.id)}
                            >
                              {t.createNew}
                            </button>
                            .
                          </p>
                        ) : (
                          items.map((t) => renderThread(t, project.id))
                        )}
                      </SidebarMenuSub>
                    )}
                  </li>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup
          {...dropZone(RECENTS)}
          className={cn(
            'rounded-md transition-colors group-data-[collapsible=icon]:hidden',
            dropTarget === RECENTS && 'bg-primary/5 ring-2 ring-inset ring-primary/40',
          )}
        >
          <div className="flex items-center gap-0.5 pr-1">
            <SidebarGroupLabel className="flex-1">{t.recents}</SidebarGroupLabel>
            <Menu.Root>
              <Menu.Trigger
                className={iconButton}
                aria-label={t.sort}
                title={t.sortTitle(sortLabels[sort])}
                disabled={threads.length < 2}
              >
                <IconArrowsSort />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner className="isolate z-50" side="bottom" align="end" sideOffset={4}>
                  <Menu.Popup className={menuPopup}>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {t.sortBy}
                    </div>
                    <Menu.RadioGroup
                      value={sort}
                      onValueChange={(value: SortKey) => changeSort(value)}
                    >
                      {SORT_KEYS.map((key) => (
                        <Menu.RadioItem
                          key={key}
                          value={key}
                          className="flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-7 outline-hidden select-none relative data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        >
                          <Menu.RadioItemIndicator className="absolute left-2 flex">
                            <IconCheck className="size-3.5" />
                          </Menu.RadioItemIndicator>
                          {sortLabels[key]}
                        </Menu.RadioItem>
                      ))}
                    </Menu.RadioGroup>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <button
              type="button"
              className={cn(iconButton, activeScope === RECENTS && 'bg-sidebar-accent text-sidebar-accent-foreground')}
              aria-label={activeScope === RECENTS ? t.exitSelect : t.select}
              title={activeScope === RECENTS ? t.exitSelect : t.select}
              aria-pressed={activeScope === RECENTS}
              disabled={activeScope !== RECENTS && ungrouped.length === 0}
              onClick={() => (activeScope === RECENTS ? exitSelecting() : startSelecting(RECENTS))}
            >
              {activeScope === RECENTS ? <IconX /> : <IconListCheck />}
            </button>
          </div>
          {activeScope === RECENTS && renderSelectBar()}
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Chats live in localStorage, so the server can only reserve their space. */}
              {!mounted && SKELETON_WIDTHS.map((width) => (
                <li key={width} className="flex h-8 items-center px-2">
                  <Skeleton className="h-4" style={{ width }} />
                </li>
              ))}
              {mounted && ungrouped.length === 0 && (
                <p className="px-2 py-1 text-sm text-muted-foreground">
                  {searching
                    ? live.length > 0
                      ? t.noResultsOutside
                      : archived.length > 0
                        ? t.onlyArchivedResults
                        : t.noMatch
                    : liveCount === 0
                      ? t.noThreads
                      : t.allInProjects}
                </p>
              )}
              <VirtualMenuItems items={ungrouped} getKey={(t) => t.id} render={(t, rowProps) => renderThread(t, RECENTS, rowProps)} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {mounted && (archived.length > 0 || (!searching && (threads.length > liveCount || dragId))) && (
          <SidebarGroup
            {...dropZone(ARCHIVED)}
            className={cn(
              'rounded-md transition-colors group-data-[collapsible=icon]:hidden',
              dropTarget === ARCHIVED && 'bg-primary/5 ring-2 ring-inset ring-primary/40',
            )}
          >
            <div className="flex items-center gap-0.5 pr-1">
              <button
                type="button"
                aria-expanded={showArchived}
                className="flex h-8 flex-1 items-center gap-2 rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-hidden hover:text-sidebar-foreground focus-visible:ring-2 ring-sidebar-ring [&>svg]:size-3.5"
                onClick={toggleArchived}
              >
                <IconArchive />
                <span>{t.archived}</span>
                <span className="tabular-nums text-sidebar-foreground/50">
                  {searching ? archived.length : threads.length - liveCount}
                </span>
                <IconChevronRight
                  className={cn('ml-auto text-sidebar-foreground/50 transition-transform', showArchived && 'rotate-90')}
                />
              </button>
              {showArchived && archived.length > 0 && (
                <button
                  type="button"
                  className={cn(iconButton, activeScope === ARCHIVED && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                  aria-label={activeScope === ARCHIVED ? t.exitSelect : t.select}
                  title={activeScope === ARCHIVED ? t.exitSelect : t.select}
                  aria-pressed={activeScope === ARCHIVED}
                  onClick={() => (activeScope === ARCHIVED ? exitSelecting() : startSelecting(ARCHIVED))}
                >
                  {activeScope === ARCHIVED ? <IconX /> : <IconListCheck />}
                </button>
              )}
            </div>
            {activeScope === ARCHIVED && renderSelectBar()}
            {showArchived && (
              <SidebarGroupContent className="animate-in fade-in slide-in-from-top-1 duration-150">
                <SidebarMenu>
                  {archived.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-muted-foreground">
                      {t.dragToArchive}
                    </p>
                  ) : (
                    <VirtualMenuItems items={archived} getKey={(t) => t.id} render={(t, rowProps) => renderThread(t, ARCHIVED, rowProps)} />
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />

      <ProjectInstructionsDialog
        project={projects.find((p) => p.id === instructionsId)}
        onClose={() => setInstructionsId(null)}
      />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <IconTrash className="size-4" />
            </span>
            <div className="grid gap-1">
              <AlertDialogTitle>
                {t.confirmTitle(deleteTargets.length)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t.confirmBody}
              </AlertDialogDescription>
            </div>
          </div>
          <ul className="max-h-40 overflow-y-auto rounded-lg border bg-muted/40 p-1">
            {deleteTargets.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground"
              >
                <IconMessage className="size-3.5 shrink-0" />
                <span className="truncate text-foreground">{t.title}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>{t.cancel}</AlertDialogClose>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {t.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}

function ThreadIcon({ id }: { id: string }) {
  const t = useMessages(messages)
  const busy = useThreadBusy(id)
  if (!busy) return <IconMessage />
  return (
    <>
      <Logo className="animate-spin [animation-duration:3s] motion-reduce:animate-none" />
      <span className="sr-only">{t.replying}</span>
    </>
  )
}
