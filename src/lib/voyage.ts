export interface VoyageTask {
  id: string
  name: string
  agentId: string
  completed: boolean
  completedAt?: number
}

export interface Voyage {
  id: string
  name: string
  treasureMap: string
  tasks: VoyageTask[]
  repos: string[]
  startedAt: number
  budget?: number
}
