export function toResultText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

export function transformVarName(str: string) {
  let str2 = str

  // snake_case to SNAKE_CASE
  if (/_[a-z]/.test(str2)) {
    str2 = str2
      .split('_')
      .map((it: string) => it.toLocaleUpperCase())
      .join('_')
  }
  if (str2 !== str) {
    return str2
  }

  // SNAKE_CASE to kebab-case
  if (/^[A-Z]+(_[A-Z]+)*$/.test(str2)) {
    str2 = str2
      .split('_')
      .map((it: string) => it.toLocaleLowerCase())
      .join('-')
  }
  if (str2 !== str) {
    return str2
  }

  // kebab-case to dot.notation
  if (/-/.test(str2)) {
    str2 = str2
      .split('-')
      .map((it: string) => it.toLocaleLowerCase())
      .join('.')
  }
  if (str2 !== str) {
    return str2
  }

  // dot.notation to space separated
  if (/\.[a-z]/.test(str2)) {
    str2 = str2.replaceAll(/(\.)([a-z])/g, (_: string, _2: string, it: string) => ' ' + it)
  }
  if (str2 !== str) {
    return str2
  }

  // space separated to Title Case
  if (/\s[a-z]/.test(str2)) {
    str2 = str2.replaceAll(/\s([a-z])/g, (_: string, it: string) => ' ' + it.toLocaleUpperCase())
    str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1)
  }
  if (str2 !== str) {
    return str2
  }

  // Title Case to CamelCase
  if (/\s[A-Z]/.test(str2)) {
    str2 = str2.replaceAll(/\s([A-Z])/g, (_: string, it: string) => it)
    str2 = str2.substring(0, 1).toLocaleLowerCase() + str2.substring(1)
  }
  if (str2 !== str) {
    return str2
  }

  // CamelCase to PascalCase
  if (/^[a-z]+[A-Z]+/.test(str2)) {
    str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1)
  }
  if (str2 !== str) {
    return str2
  }

  // PascalCase to snake_case
  if (/[^\s][A-Z]/.test(str2)) {
    str2 = str2.replaceAll(/[A-Z]/g, (it: string, offset: number) => {
      return (offset == 0 ? '' : '_') + it.toLocaleLowerCase()
    })
  }

  return str2
}
