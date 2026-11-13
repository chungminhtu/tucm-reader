import { readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import { defineConfig, type Plugin } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { name, version } from './package.json'

// crxjs emits a content-script loader ending in `.catch(console.error)`.
// This extension must never write to the page console, so strip it.
const stripLoaderConsole: Plugin = {
  name: 'strip-loader-console',
  enforce: 'post',
  writeBundle(options, bundle) {
    const outDir = options.dir ?? 'dist'
    for (const [fileName, file] of Object.entries(bundle)) {
      const code = file.type === 'chunk' ? file.code : String(file.source)
      if (!code.includes('.catch(console.error)')) continue
      writeFileSync(
        path.resolve(outDir, fileName),
        code.replace('.catch(console.error)', '.catch(() => {})')
      )
    }
  },
}

// update.json = version + every file of the build, read by public/update.html (self-update button).
const writeUpdateJson: Plugin = {
  name: 'write-update-json',
  enforce: 'post',
  closeBundle() {
    const walk = (d: string, pre = ''): string[] =>
      readdirSync(d).flatMap((n) => {
        const rel = pre + n
        return statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n), rel + '/') : [rel]
      })
    const files = walk('dist').filter((f) => f !== 'update.json' && !f.startsWith('.'))
    writeFileSync('dist/update.json', JSON.stringify({ version, files }))
  },
}

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    crx({ manifest }),
    stripLoaderConsole,
    writeUpdateJson,
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
})
