import { EdgeCorePlugins } from 'edge-core-js/lib/types/types'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    addEdgeCorePlugins?(plugins: EdgeCorePlugins): void
  }
}
