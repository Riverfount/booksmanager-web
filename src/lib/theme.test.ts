// The Gruvbox palette lives in src/index.css as theme tokens; code must reference them, not copy the hex values.
const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('cores do tema', () => {
  it('encontra os arquivos de código para conferir', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20)
  })

  it('nenhum arquivo de código usa cor em hex solta; use os tokens (var(--color-…) ou classes do Tailwind)', () => {
    const offenders = Object.entries(sources).flatMap(([file, text]) =>
      text.split('\n').flatMap((line, i) => (/#[0-9a-fA-F]{6}\b/.test(line) ? [`${file.replace('/src/', 'src/')}:${i + 1}`] : [])),
    )
    expect(offenders).toEqual([])
  })
})
