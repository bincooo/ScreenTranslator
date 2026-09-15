import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MARKDOWN_PATTERNS = [
  /^#{1,6}\s+\S/m,
  /^>\s+\S/m,
  /^[-*+]\s+\S/m,
  /^\d+\.\s+\S/m,
  /^```/m,
  /`[^`\n]+`/,
  /\[[^\]]+\]\([^)]+\)/,
  /^-{3,}\s*$/m,
  /(?<!\w)\*\*[^\s*][^*\n]*\*\*(?!\w)/,
  /(?<!\w)__[^\s_][^_\n]*__(?!\w)/,
  /(?<!\w)\*[^\s*][^*\n]*\*(?!\w)/,
  /(?<!\w)_[^\s_][^_\n]*_(?!\w)/,
  /~~[^\s~][^~\n]*~~/,
]

const MARKDOWN_TABLE_SEPARATOR_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/m

export function isMarkdownLike(value: unknown) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (text.length < 3) return false

  return (
    MARKDOWN_TABLE_SEPARATOR_PATTERN.test(text) ||
    MARKDOWN_PATTERNS.some((pattern) => pattern.test(text))
  )
}

export function MarkdownResult({ value, appFontSize }: { value: string; appFontSize: number }) {
  return (
    <div
      className="select-text whitespace-pre-wrap wrap-break-word text-default-700"
      style={{ fontSize: `${appFontSize}px` }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-2 text-[1.35em] font-semibold">{children}</h1>,
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-[1.2em] font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-[1.1em] font-semibold">{children}</h3>
          ),
          h4: ({ children }) => <h4 className="mb-1.5 mt-2 font-semibold">{children}</h4>,
          p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-default-300 pl-3 text-default-500">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => (
            <code
              className={`${className ?? ''} rounded-small bg-default-100 px-1 py-0.5 font-mono text-[0.92em]`}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto rounded-small bg-default-100 p-2 leading-relaxed [&_code]:block [&_code]:bg-transparent [&_code]:p-0">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-3 border-default-200" />,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-left">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-default-200 bg-default-100 px-2 py-1 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-default-200 px-2 py-1">{children}</td>,
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}
