import { create } from 'zustand'
import type { Credentials } from '@/shared/api/green-api'

type Session = {
  credentials: Credentials
  id: string
  controller: AbortController
}

type SessionState = {
  session: Session | null
  connect: (credentials: Credentials) => void
  disconnect: () => void
}

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  connect: (credentials) => {
    get().session?.controller.abort()
    set({
      session: {
        credentials,
        id: crypto.randomUUID(),
        controller: new AbortController(),
      },
    })
  },
  disconnect: () => {
    get().session?.controller.abort()
    set({ session: null })
  },
}))
