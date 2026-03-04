interface Commitment {
  id: string
  text: string
  carryCount: number
}

interface BrokenPatternSignalsProps {
  commitments: Commitment[]
}

// P-5.03: Read-time derived pattern signal — no DB writes, always fresh
export default function BrokenPatternSignals({ commitments }: BrokenPatternSignalsProps) {
  const broken = commitments.filter((c) => c.carryCount >= 2)
  if (broken.length === 0) return null

  return (
    <div data-testid="broken-pattern-signals" className="mt-4 flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pattern Signals</h3>
      {broken.map((c, i) => (
        <div
          key={c.id}
          data-testid={`broken-pattern-signal-${i}`}
          className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800"
        >
          Commitment &ldquo;{c.text.slice(0, 60)}{c.text.length > 60 ? '…' : ''}&rdquo; has been carried
          forward {c.carryCount} times — consider discussing this directly.
        </div>
      ))}
    </div>
  )
}
