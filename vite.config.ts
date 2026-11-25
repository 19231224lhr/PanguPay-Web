import { fileURLToPath, URL } from 'node:url'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mountLinkFlow } from './src/graphics/linkFlow'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'wallet-exit-flow',
      transformIndexHtml(html) {
        return html.replace('<!-- wallet-exit-flow-script -->', () => `<script>
          if (document.documentElement.hasAttribute('data-wallet-exit')) {
            const overlay = document.getElementById('wallet-exit-loading')
            const stop = (${mountLinkFlow.toString()})(overlay.querySelector('svg'))
            overlay.addEventListener('wallet-exit-finished', stop, {once: true})
          }
        </script>`)
      },
    },
    {
      name: 'wallet-shell-cache',
      apply: 'build',
      async writeBundle({ dir }, bundle) {
        const html = bundle['index.html']
        if (!dir || html?.type !== 'asset') return
        const worker = await readFile(new URL('./scripts/wallet-shell-worker.js', import.meta.url), 'utf8')
        const assets = Object.keys(bundle).filter((file) => file.startsWith('assets/'))
        const id = createHash('sha256').update(html.source).update(assets.join('\n')).update(worker)
          .digest('hex').slice(0, 16)
        const shell = `assets/wallet-shell-${id}.html`
        const release = JSON.stringify({ id, shell, assets })
        await Promise.all([
          writeFile(join(dir, shell), html.source),
          writeFile(join(dir, 'wallet-shell-worker.js'), `const release = ${release}\n${worker}`),
        ])
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
