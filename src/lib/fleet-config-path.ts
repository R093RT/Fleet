import path from 'path'

export function getConfigPath(): string {
  return process.env['REACTIONS_CONFIG'] ?? path.join(process.cwd(), 'fleet.yaml')
}
