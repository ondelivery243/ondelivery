#!/usr/bin/env node

/**
 * Script de Release para ON Delivery PWA
 * 
 * Uso: 
 *   npm run release 1.2.0           # Actualiza versión
 *   npm run release patch           # Incrementa patch (1.0.0 → 1.0.1)
 *   npm run release minor           # Incrementa minor (1.0.0 → 1.1.0)
 *   npm run release major           # Incrementa major (1.0.0 → 2.0.0)
 *   npm run release 1.2.0 --notes   # Con notas interactivas
 * 
 * Este script actualiza automáticamente:
 *   - src/config/version.js
 *   - package.json
 *   - public/manifest.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function getVersionFiles() {
  return {
    versionJs: path.join(rootDir, 'src/config/version.js'),
    packageJson: path.join(rootDir, 'package.json'),
    manifest: path.join(rootDir, 'public/manifest.json')
  }
}

function getCurrentVersion() {
  const packagePath = path.join(rootDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  return pkg.version
}

function validateVersion(version) {
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$/
  if (!semverRegex.test(version)) {
    log('❌ Formato de versión inválido. Usa: X.Y.Z (ej: 1.2.0)', 'red')
    return false
  }
  return true
}

function incrementVersion(current, type) {
  const parts = current.split('.').map(Number)
  switch (type) {
    case 'major':
      parts[0]++
      parts[1] = 0
      parts[2] = 0
      break
    case 'minor':
      parts[1]++
      parts[2] = 0
      break
    case 'patch':
    default:
      parts[2]++
      break
  }
  return parts.join('.')
}

function updateVersionJs(filePath, version, releaseNotes = []) {
  const content = `// src/config/version.js
// Archivo centralizado para la versión de la aplicación
// Actualizar este archivo con cada release

export const APP_CONFIG = {
  version: '${version}',
  buildDate: new Date().toISOString().split('T')[0],
  releaseNotes: ${JSON.stringify(releaseNotes, null, 4).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n')}
}

// Función para obtener la versión actual
export const getAppVersion = () => APP_CONFIG.version

// Función para mostrar info de versión en consola
export const logAppInfo = () => {
  console.log('%c🚀 ON Delivery', 'font-size: 24px; font-weight: bold; color: #00C853;')
  console.log(\`%cVersión: \${APP_CONFIG.version}\`, 'font-size: 12px; color: #888;')
  console.log(\`%cBuild: \${APP_CONFIG.buildDate}\`, 'font-size: 12px; color: #888;')
}

// Auto-log en desarrollo
if (import.meta.env.DEV) {
  logAppInfo()
}

export default APP_CONFIG
`

  fs.writeFileSync(filePath, content, 'utf8')
}

function updatePackageJson(filePath, version) {
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  pkg.version = version
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
}

function updateManifest(filePath, version) {
  const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  manifest.version = version
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
}

function promptReleaseNotes() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    log('\n📝 Ingresa las notas del release (una por línea)', 'cyan')
    log('   Presiona Enter en una línea vacía para terminar\n', 'yellow')

    const notes = []
    
    const promptNote = (index) => {
      rl.question(`   Nota ${index + 1}: `, (answer) => {
        if (answer.trim() === '') {
          rl.close()
          resolve(notes)
        } else {
          notes.push(answer.trim())
          promptNote(index + 1)
        }
      })
    }

    promptNote(0)
  })
}

function printSummary(version, releaseNotes, files) {
  log('\n' + '='.repeat(50), 'cyan')
  log('   🚀 RELEASE CREADO EXITOSAMENTE', 'green')
  log('='.repeat(50), 'cyan')
  log(`\n   Versión: ${version}`, 'bold')
  log(`   Fecha: ${new Date().toISOString().split('T')[0]}\n`, 'blue')
  
  if (releaseNotes.length > 0) {
    log('   📋 Notas del release:', 'yellow')
    releaseNotes.forEach((note, i) => {
      log(`      ${i + 1}. ${note}`, 'reset')
    })
  }

  log('\n   📁 Archivos actualizados:', 'yellow')
  log(`      ✓ src/config/version.js`, 'green')
  log(`      ✓ package.json`, 'green')
  log(`      ✓ public/manifest.json`, 'green')

  log('\n   📤 Próximos pasos:', 'cyan')
  log('      1. Revisa los cambios: git diff', 'reset')
  log('      2. Confirma: git add . && git commit -m "v' + version + ' - Notas del release"', 'reset')
  log('      3. Despliega: git push', 'reset')
  log('      4. El PWA se actualizará automáticamente\n', 'reset')
}

async function main() {
  const args = process.argv.slice(2)
  
  // Mostrar ayuda
  if (args.includes('-h') || args.includes('--help')) {
    log('\n📖 Uso del script de release:\n', 'cyan')
    log('   npm run release <version>              Nueva versión específica', 'yellow')
    log('   npm run release patch                  Incrementa Z (1.0.0 → 1.0.1)', 'yellow')
    log('   npm run release minor                  Incrementa Y (1.0.0 → 1.1.0)', 'yellow')
    log('   npm run release major                  Incrementa X (1.0.0 → 2.0.0)', 'yellow')
    log('   npm run release 1.2.0 --notes          Solicita notas interactivas', 'yellow')
    log('\n   Ejemplos:', 'cyan')
    log('     npm run release 1.2.0', 'reset')
    log('     npm run release patch', 'reset')
    log('     npm run release minor --notes\n', 'reset')
    process.exit(0)
  }

  // Determinar nueva versión
  const currentVersion = getCurrentVersion()
  let newVersion = args[0]
  const useInteractiveNotes = args.includes('--notes') || args.includes('-n')

  // Si es un tipo de incremento (patch, minor, major)
  if (['patch', 'minor', 'major'].includes(newVersion)) {
    newVersion = incrementVersion(currentVersion, newVersion)
  } else if (!newVersion || !validateVersion(newVersion)) {
    log(`\n❌ Debes especificar una versión válida`, 'red')
    log(`   Versión actual: ${currentVersion}`, 'yellow')
    log(`   Uso: npm run release <versión|patch|minor|major>\n`, 'yellow')
    process.exit(1)
  }

  log(`\n🔄 Actualizando versión: ${currentVersion} → ${newVersion}`, 'cyan')

  // Obtener notas del release
  let releaseNotes = []
  if (useInteractiveNotes) {
    releaseNotes = await promptReleaseNotes()
  } else {
    // Notas por defecto
    releaseNotes = [
      'Mejoras y correcciones de errores',
      'Actualización de seguridad',
      'Optimización de rendimiento'
    ]
  }

  // Actualizar archivos
  const files = getVersionFiles()
  
  try {
    updateVersionJs(files.versionJs, newVersion, releaseNotes)
    updatePackageJson(files.packageJson, newVersion)
    updateManifest(files.manifest, newVersion)
    
    printSummary(newVersion, releaseNotes, files)
  } catch (error) {
    log(`\n❌ Error actualizando archivos: ${error.message}`, 'red')
    process.exit(1)
  }
}

main()