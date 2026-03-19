export interface ReactionTrigger {
  type: 'file_change' | 'port_unavailable'
  agent: string    // match by agent.name
  path?: string    // substring to match against changed filename (file_change)
  port?: number    // port to poll (port_unavailable)
}

export interface ReactionAction {
  type: 'send_prompt' | 'set_status'
  agent: string
  message?: string  // send_prompt: supports {filename} placeholder
  status?: string   // set_status
}

export interface ReactionConfig {
  name: string
  trigger: ReactionTrigger
  action: ReactionAction
  cooldown?: number  // seconds, default 60
}
