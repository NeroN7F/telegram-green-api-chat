import { lazy, Suspense } from 'react'
import { useSession } from '@/entities/session'
import { ConnectionPage } from '@/pages/connection'

const MessengerPage = lazy(() =>
  import('@/pages/messenger').then((module) => ({
    default: module.MessengerPage,
  })),
)

export function App() {
  const session = useSession((state) => state.session)
  return session ? (
    <Suspense
      fallback={
        <main
          className="flex min-h-dvh items-center justify-center"
          role="status"
        >
          Открываем чаты…
        </main>
      }
    >
      <MessengerPage key={session.id} />
    </Suspense>
  ) : (
    <ConnectionPage />
  )
}
