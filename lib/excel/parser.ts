import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchemaMapping {
  itemName: string | null
  status: string | null
  size: string | null
  createdDate: string | null
  completedDate: string | null
  revenueImpact: string | null
}

export interface ParsedRow {
  itemName: string | null
  status: string | null
  size: string | null
  createdDate: Date | null
  completedDate: Date | null
  revenueImpact: number | null
  [key: string]: unknown
}

export interface ParseResult {
  rows: ParsedRow[]
  detectedSchema: SchemaMapping
  columns: string[]          // all original column names from the sheet header row
  unmappedColumns: string[]
  sheetNames: string[]
  selectedSheet: string
  needsMapping: boolean
}

// ─── Status normalisation map ─────────────────────────────────────────────────

const STATUS_ALIASES: Record<string, string> = {
  // ── Completed ──────────────────────────────────────────────────────────────
  done: 'Completed',
  finished: 'Completed',
  complete: 'Completed',
  completed: 'Completed',
  shipped: 'Completed',
  closed: 'Completed',
  launched: 'Completed',
  live: 'Completed',
  released: 'Completed',
  deployed: 'Completed',
  resolved: 'Completed',
  merged: 'Completed',
  delivered: 'Completed',
  published: 'Completed',
  archived: 'Completed',
  ga: 'Completed',                // General Availability
  'general availability': 'Completed',
  'in production': 'Completed',
  'shipped to customers': 'Completed',
  'rolled out': 'Completed',
  // ── In Progress ────────────────────────────────────────────────────────────
  'in progress': 'In Progress',
  'in-progress': 'In Progress',
  inprogress: 'In Progress',
  wip: 'In Progress',
  active: 'In Progress',
  doing: 'In Progress',
  started: 'In Progress',
  ongoing: 'In Progress',
  'in flight': 'In Progress',
  'in-flight': 'In Progress',
  inflight: 'In Progress',
  'in review': 'In Progress',
  review: 'In Progress',
  blocked: 'In Progress',
  'on hold': 'In Progress',
  paused: 'In Progress',
  // ── Planned ────────────────────────────────────────────────────────────────
  planned: 'Planned',
  backlog: 'Planned',
  todo: 'Planned',
  'to do': 'Planned',
  'to-do': 'Planned',
  upcoming: 'Planned',
  new: 'Planned',
  open: 'Planned',
  queued: 'Planned',
  ready: 'Planned',
  scoped: 'Planned',
}

export function normaliseStatus(raw: string): string {
  const key = raw.trim().toLowerCase()
  return STATUS_ALIASES[key] ?? raw.trim()
}

// ─── Column detection ─────────────────────────────────────────────────────────

const FIELD_PATTERNS: Record<keyof SchemaMapping, RegExp[]> = {
  itemName: [/item.?name/i, /feature/i, /task/i, /title/i, /name/i, /project/i, /work.?item/i],
  status: [/status/i, /state/i, /stage/i],
  size: [/size/i, /t.?shirt/i, /effort/i, /complexity/i],
  createdDate: [/creat(ed)?.?date/i, /start.?date/i, /opened/i, /created.?at/i, /date.?created/i],
  completedDate: [/complet(ed)?.?date/i, /done.?date/i, /closed.?date/i, /finish(ed)?.?date/i, /resolved.?date/i, /end.?date/i],
  revenueImpact: [/revenue/i, /impact/i, /value/i, /business.?impact/i, /arr/i, /mrr/i, /gmv/i],
}

function detectColumn(columns: string[], patterns: RegExp[]): string | null {
  for (const col of columns) {
    for (const pat of patterns) {
      if (pat.test(col)) return col
    }
  }
  return null
}

export function detectSchema(columns: string[]): SchemaMapping {
  const mapping: SchemaMapping = {
    itemName: null,
    status: null,
    size: null,
    createdDate: null,
    completedDate: null,
    revenueImpact: null,
  }
  for (const field of Object.keys(mapping) as (keyof SchemaMapping)[]) {
    mapping[field] = detectColumn(columns, FIELD_PATTERNS[field])
  }
  return mapping
}

// ─── Value parsers ────────────────────────────────────────────────────────────

function parseDate(val: unknown): Date | null {
  if (val == null) return null
  if (val instanceof Date) return val
  if (typeof val === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val)
    if (date) return new Date(date.y, date.m - 1, date.d)
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function parseRevenue(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,£€]/g, '').trim()
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
  return null
}

function parseSize(val: unknown): string | null {
  if (val == null) return null
  const s = String(val).trim().toUpperCase()
  if (['S', 'M', 'L', 'XL', 'XS'].includes(s)) return s
  if (/small/i.test(s)) return 'S'
  if (/med/i.test(s)) return 'M'
  if (/large/i.test(s)) return 'L'
  return String(val).trim() || null
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

function mapRow(raw: Record<string, unknown>, schema: SchemaMapping): ParsedRow {
  return {
    itemName: schema.itemName != null ? String(raw[schema.itemName] ?? '').trim() || null : null,
    status: schema.status != null && raw[schema.status] != null
      ? normaliseStatus(String(raw[schema.status]))
      : null,
    size: schema.size != null ? parseSize(raw[schema.size]) : null,
    createdDate: schema.createdDate != null ? parseDate(raw[schema.createdDate]) : null,
    completedDate: schema.completedDate != null ? parseDate(raw[schema.completedDate]) : null,
    revenueImpact: schema.revenueImpact != null ? parseRevenue(raw[schema.revenueImpact]) : null,
    ...raw,
  }
}

// ─── Header-row detection ─────────────────────────────────────────────────────

function scoreSchema(schema: SchemaMapping): number {
  return Object.values(schema).filter(Boolean).length
}

/**
 * Try rows 0–4 as the header row and return the parse that yields the best
 * schema detection score. Handles Google Sheets smart tables where the first
 * row is a title or description and the real headers are on row 2+.
 */
function findBestHeaderRow(
  sheet: XLSX.WorkSheet
): { rawRows: Record<string, unknown>[]; columns: string[]; detectedSchema: SchemaMapping } {
  let bestScore = -1
  let best = { rawRows: [] as Record<string, unknown>[], columns: [] as string[], detectedSchema: detectSchema([]) }

  for (let headerRow = 0; headerRow <= 4; headerRow++) {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      range: headerRow,
    })
    if (rawRows.length === 0) continue

    const columns = Object.keys(rawRows[0]).filter((c) => !c.startsWith('__EMPTY'))
    const schema = detectSchema(columns)
    const score = scoreSchema(schema)

    if (score > bestScore) {
      bestScore = score
      best = { rawRows, columns, detectedSchema: schema }
    }
  }

  return best
}

// ─── Main parse function ──────────────────────────────────────────────────────

export function parseExcelBuffer(
  buffer: Buffer,
  options: { sheetName?: string; schemaOverride?: Partial<SchemaMapping> } = {}
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheetNames = workbook.SheetNames

  const selectedSheet = options.sheetName ?? sheetNames[0]
  const sheet = workbook.Sheets[selectedSheet]
  if (!sheet) throw new Error(`Sheet "${selectedSheet}" not found`)

  const { rawRows, columns, detectedSchema } = findBestHeaderRow(sheet)

  if (rawRows.length === 0) return {
    rows: [], detectedSchema: detectSchema([]), columns: [], unmappedColumns: [],
    sheetNames, selectedSheet, needsMapping: false,
  }

  // Apply any manual overrides
  if (options.schemaOverride) {
    Object.assign(detectedSchema, options.schemaOverride)
  }

  const mappedCols = Object.values(detectedSchema).filter(Boolean) as string[]
  const unmappedColumns = columns.filter((c) => !mappedCols.includes(c))

  // needsMapping if required fields (itemName, status) weren't auto-detected
  const needsMapping = !detectedSchema.itemName || !detectedSchema.status

  const rows = rawRows.map((r) => mapRow(r, detectedSchema))

  return { rows, detectedSchema, columns, unmappedColumns, sheetNames, selectedSheet, needsMapping }
}
