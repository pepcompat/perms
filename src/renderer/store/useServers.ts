import { create } from 'zustand'
import type { ServerRecord } from '@shared/types'

interface ServersState {
  servers: ServerRecord[]
  loading: boolean
  refresh: () => Promise<void>
}

export const useServers = create<ServersState>((set) => ({
  servers: [],
  loading: false,
  refresh: async () => {
    set({ loading: true })
    const servers = await window.api.servers.list()
    set({ servers, loading: false })
  }
}))
