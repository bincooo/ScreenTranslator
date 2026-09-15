interface PronunciationResult {
  region?: string
  symbol?: string
  voice?: unknown
}

interface ExplanationResult {
  trait?: string
  explains: string[]
}

interface SentenceResult {
  source?: string
  target?: string
}

export interface RichTranslationResult {
  pronunciations: PronunciationResult[]
  explanations: ExplanationResult[]
  associations: string[]
  sentence: SentenceResult[]
}

export type TranslationResult = string | RichTranslationResult

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

export function toOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function toRichTranslationResult(value: Record<string, unknown>): RichTranslationResult {
  return {
    pronunciations: toArray(value.pronunciations).map((item) => {
      const pronunciation = isRecord(item) ? item : {}
      return {
        region: toOptionalText(pronunciation.region),
        symbol: toOptionalText(pronunciation.symbol),
        voice: pronunciation.voice,
      }
    }),
    explanations: toArray(value.explanations).map((item) => {
      const explanation = isRecord(item) ? item : {}
      return {
        trait: toOptionalText(explanation.trait),
        explains: toArray(explanation.explains).map(toText),
      }
    }),
    associations: toArray(value.associations).map(toText),
    sentence: toArray(value.sentence).map((item) => {
      const sentence = isRecord(item) ? item : {}
      return {
        source: toOptionalText(sentence.source),
        target: toOptionalText(sentence.target),
      }
    }),
  }
}

export function toTranslationResult(value: unknown): TranslationResult {
  if (typeof value === 'string') {
    return value
  }
  if (isRecord(value)) {
    return toRichTranslationResult(value)
  }
  return toText(value)
}

export function hasVisibleResult(value: unknown): boolean {
  return typeof value === 'string' ? value !== '' : value !== undefined && value !== null
}

export function invokeOnce<TArgs extends unknown[]>(fn: (...args: TArgs) => void) {
  let isInvoke = false

  return (...args: TArgs) => {
    if (isInvoke) {
      return
    } else {
      fn(...args)
      isInvoke = true
    }
  }
}
