import fs from 'fs'
import path from 'path'

type Config = {
  baseUrl?: string
  paths?: Record<string, string[]>
}

export default function resolveImportPath(
  importPath: string,
  config: Config,
): { resolvedPath: string; relativePath: string } | null {
  // Handle case where importPath is a local file
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    const resolvedPath = path.resolve(importPath)
    const relativePath = path.relative(process.cwd(), resolvedPath)

    return { resolvedPath, relativePath }
  }

  // Handle case where baseUrl is set in TS config
  if (config.baseUrl) {
    const resolvedPath = path.resolve(config.baseUrl, importPath)
    const relativePath = path.relative(process.cwd(), resolvedPath)
    return { resolvedPath, relativePath }
  }

  // Handle case where webpack aliases are defined
  if (config.paths) {
    for (const alias in config.paths) {
      if (importPath.startsWith(alias)) {
        const resolvedAlias = config.paths[alias][0]
        const resolvedPath = importPath.replace(alias, resolvedAlias)
        const relativePath = path.relative(process.cwd(), resolvedPath)

        return { resolvedPath, relativePath }
      }
    }
  }

  // If no valid configuration is found, return null
  // (Would be nice to log this somewhere so users know what's going on, too)
  return null
}

// TODO: Manage cache with ESLint's cache API (I assume this is a thing)
let cachedConfig: Config | null = null
let cacheCleared = false

function getConfig(): Config | null {
  if (!cachedConfig || cacheCleared) {
    cachedConfig = null
    cacheCleared = false

    // Look for tsconfig.json file
    let tsConfig: Config | undefined
    let tsConfigPath = path.join(process.cwd(), 'tsconfig.json')
    if (fs.existsSync(tsConfigPath)) {
      const tsConfigContent = fs.readFileSync(tsConfigPath, 'utf8')
      try {
        tsConfig = JSON.parse(tsConfigContent).compilerOptions
      } catch (e) {
        console.error(`Error parsing tsconfig.json: ${e}`)
      }
    }

    // Look for webpack.config.js file
    let webpackConfig: Config | undefined
    let webpackConfigPath = path.join(process.cwd(), 'webpack.config.js')
    if (fs.existsSync(webpackConfigPath)) {
      const webpackConfigModule = require(webpackConfigPath)
      if (webpackConfigModule.resolve && webpackConfigModule.resolve.alias) {
        webpackConfig = {
          paths: webpackConfigModule.resolve.alias,
        }
      }
    }

    // Combine the configs if both are found
    if (tsConfig && webpackConfig) {
      cachedConfig = {
        baseUrl: tsConfig.baseUrl,
        paths: {
          ...webpackConfig.paths,
          ...tsConfig.paths,
        },
      }
    } else {
      cachedConfig = tsConfig ?? webpackConfig ?? null
    }
  }

  return cachedConfig
}

function clearCache(): void {
  cacheCleared = true
}
