import { Component, type ReactNode } from 'react'
import { Button } from '@/shared/ui/button'

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">
            Не удалось открыть приложение
          </h1>
          <p className="text-sm text-muted-foreground">
            Обновите страницу и подключитесь снова.
          </p>
          <Button onClick={() => window.location.reload()}>
            Обновить страницу
          </Button>
        </main>
      )
    }
    return this.props.children
  }
}
