import { EdgeCorePlugins } from 'edge-core-js/lib/types/types'

declare global {
  interface Window {
    addEdgeCorePlugins?(plugins: EdgeCorePlugins): void
  }
}
