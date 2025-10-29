import { defineConfig } from 'vite'
import devServer from '@hono/vite-dev-server'
import build from '@hono/vite-build/node'

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      plugins: [
        devServer({
          entry: 'src/index.tsx'
        })
      ]
    }
  }

  return {
    plugins: [
      build({
        entry: 'src/index.tsx',
        outputDir: 'dist',
        emptyOutDir: true
      })
    ]
  }
})
