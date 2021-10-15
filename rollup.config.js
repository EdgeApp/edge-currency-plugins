import resolve from '@rollup/plugin-node-resolve'
import sucrase from '@rollup/plugin-sucrase'
import mjs from 'rollup-plugin-mjs-entry'

import packageJson from './package.json'

// Matches all dependencies and the nested modules of the dependencies
const dependencies = Object.keys(packageJson.dependencies).map(
  dep => new RegExp(`^${dep}(/.*)?$`)
)
const extensions = ['.ts']
const sucraseOpts = {
  exclude: ['node_modules/**'],
  transforms: ['typescript']
}
const resolveOpts = { extensions }

const entriesMap = Object.keys(packageJson.exports)
  .filter(exportName => exportName !== '.')
  .map(exportName => exportName.replace('./', ''))
  .reduce((map, key) => ({ ...map, [key]: `src/${key}.ts` }), {})

export default [
  {
    external: [...dependencies],
    input: 'src/index.ts',
    output: [
      {
        exports: 'default',
        file: packageJson.main,
        format: 'cjs'
      },
      {
        exports: 'default',
        file: packageJson.module,
        format: 'es'
      }
    ],
    plugins: [resolve(resolveOpts), sucrase(sucraseOpts), mjs()]
  },
  {
    external: [...dependencies],
    input: entriesMap,
    output: {
      dir: 'lib',
      entryFileNames: '[name].js',
      exports: 'default',
      format: 'cjs'
    },
    plugins: [resolve(resolveOpts), sucrase(sucraseOpts), mjs()]
  }
]
