import { z } from 'zod'

export const AgentConfigSchema = z.object({
  name: z.string(),
  path: z.string(),
  role: z.string().optional(),
  devPort: z.number().optional(),
  agentType: z.enum(['worker', 'quartermaster']).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
})

export const ReactionTriggerSchema = z.object({
  type: z.enum(['file_change', 'port_unavailable']),
  agent: z.string(),
  path: z.string().optional(),
  port: z.number().optional(),
})

export const ReactionActionSchema = z.object({
  type: z.enum(['send_prompt', 'set_status']),
  agent: z.string(),
  message: z.string().optional(),
  status: z.string().optional(),
})

export const ReactionConfigSchema = z.object({
  name: z.string(),
  trigger: ReactionTriggerSchema,
  action: ReactionActionSchema,
  cooldown: z.number().optional(),
})

export const FleetYamlSchema = z.object({
  agents: z.array(AgentConfigSchema).optional(),
  reactions: z.array(ReactionConfigSchema).optional(),
})
