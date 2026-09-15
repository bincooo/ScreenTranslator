import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function listSystemFonts(): Promise<string[]> {
  if (process.platform !== 'win32') {
    return []
  }

  const { stdout } = await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }',
    ],
    {
      windowsHide: true,
      timeout: 5000,
    },
  )

  return [
    ...new Set(
      stdout
        .split(/\r?\n/)
        .map((font) => font.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b))
}
