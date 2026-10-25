import { createFileRoute } from '@tanstack/react-router'
import { ChatView } from '@/components/chat-view'
import { ChatViewSkeleton } from '@/components/chat-view-skeleton'

export const Route = createFileRoute('/_app/chat/$threadId')({
  ssr: false,
  // Server-rendered in place of the client-only view, so the composer shows before the chat bundle loads.
  pendingComponent: ChatPending,
  component: ChatPage,
})

function ChatPending() {
  const { threadId } = Route.useParams()
  return <ChatViewSkeleton threadId={threadId} />
}

function ChatPage() {
  const { threadId } = Route.useParams()
  return <ChatView key={threadId} threadId={threadId} />
}
