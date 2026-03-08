import Anthropic from '@anthropic-ai/sdk'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CRITIQUE_MODEL = 'claude-sonnet-4-6'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CritiqueContext {
  featureName: string
  userType: string
  featureGoal: string
  successMetric: string
  constraints: string | null
  stage: 'EXPLORATORY' | 'FINAL_POLISH'
  focusAreas: string[]
  imageCount: number
}

export interface CritiqueIssue {
  category: 'CRITICAL' | 'UX_IMPROVEMENT' | 'VISUAL_CRAFT' | 'ACCESSIBILITY' | 'PRODUCT_THINKING'
  title: string
  description: string
  userImpact: string
  suggestedFix: string
  location: {
    screenshotIndex: number
    x: number
    y: number
  } | null
}

export interface CritiqueResult {
  executiveSummary: {
    clarityScore: number
    primaryRisk: string
    primaryOpportunity: string
  }
  criticalIssues: CritiqueIssue[]
  uxImprovements: CritiqueIssue[]
  visualCraftFeedback: CritiqueIssue[]
  accessibilityIssues: CritiqueIssue[]
  productThinking: CritiqueIssue[]
  missedOpportunities: string[]
  questionsForDesigner: string[]
  coachingInsight: string | null
}

// ─── Singleton client ─────────────────────────────────────────────────────────

let _defaultClient: Anthropic | null = null

function getClient(client?: Anthropic): Anthropic {
  if (client) return client
  if (!_defaultClient) {
    _defaultClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _defaultClient
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function callClaudeWithRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1000): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (retries > 0 && isTransientError(err)) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return callClaudeWithRetry(fn, retries - 1, delayMs)
    }
    throw err
  }
}

function isTransientError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status >= 500 || err.status === 529 || err.status === 429
  }
  return err instanceof Error && err.message.toLowerCase().includes('fetch')
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildCritiquePrompt(context: CritiqueContext): string {
  const focusText = context.focusAreas.length > 0
    ? context.focusAreas.join(', ')
    : 'all areas (UX, visual, interaction, clarity, business logic, accessibility)'

  return [
    `You are an expert design critique partner for a senior design manager. You provide structured, principle-driven design critique — not surface-level feedback.`,
    ``,
    `You evaluate designs using:`,
    `- Usability heuristics (Nielsen): visibility, match with real world, user control, error prevention, recognition over recall, consistency, flexibility, minimalism, error recovery`,
    `- UX principles: information hierarchy, progressive disclosure, feedback loops, affordances, cognitive load, decision friction, task completion clarity, edge case handling`,
    `- Visual craft: alignment & grid, typography scale, spacing rhythm, contrast, visual weight balance, CTA prominence`,
    `- Accessibility: color contrast, tap targets, text readability, state differentiation`,
    `- Product thinking: does it drive the intended metric, clarity of value, unnecessary friction, scalability`,
    ``,
    `Context:`,
    `- Feature: ${context.featureName}`,
    `- Target user: ${context.userType}`,
    `- Goal: ${context.featureGoal}`,
    `- Success metric: ${context.successMetric}`,
    `- Constraints: ${context.constraints || 'None specified'}`,
    `- Design stage: ${context.stage === 'EXPLORATORY' ? 'Exploratory (focus on structural issues)' : 'Final polish (focus on craft and detail)'}`,
    `- Focus areas: ${focusText}`,
    `- Number of screens provided: ${context.imageCount}`,
    ``,
    `Analyze the provided design screenshots and return a JSON object with exactly these keys:`,
    `{`,
    `  "executiveSummary": {`,
    `    "clarityScore": <number 1-100>,`,
    `    "primaryRisk": "<one sentence>",`,
    `    "primaryOpportunity": "<one sentence>"`,
    `  },`,
    `  "criticalIssues": [{"category": "CRITICAL", "title": "", "description": "", "userImpact": "", "suggestedFix": "", "location": {"screenshotIndex": 0, "x": 50, "y": 30}}],`,
    `  "uxImprovements": [{"category": "UX_IMPROVEMENT", "title": "", "description": "", "userImpact": "", "suggestedFix": "", "location": {"screenshotIndex": 0, "x": 50, "y": 30}}],`,
    `  "visualCraftFeedback": [{"category": "VISUAL_CRAFT", "title": "", "description": "", "userImpact": "", "suggestedFix": "", "location": {"screenshotIndex": 0, "x": 50, "y": 30}}],`,
    `  "accessibilityIssues": [{"category": "ACCESSIBILITY", "title": "", "description": "", "userImpact": "", "suggestedFix": "", "location": {"screenshotIndex": 0, "x": 50, "y": 30}}],`,
    `  "productThinking": [{"category": "PRODUCT_THINKING", "title": "", "description": "", "userImpact": "", "suggestedFix": "", "location": {"screenshotIndex": 0, "x": 50, "y": 30}}],`,
    `  "missedOpportunities": ["<string — upsell, delight moment, trust reinforcement, micro-interaction idea>"],`,
    `  "questionsForDesigner": ["<probing question the manager should ask the designer>"],`,
    `  "coachingInsight": "<optional pattern observation for designer growth, or null>"`,
    `}`,
    ``,
    `Rules:`,
    `- Return ONLY valid JSON. No prose, no markdown fences.`,
    `- IMPORTANT: For each issue, include a "location" object with {"screenshotIndex": <0-based index of which screenshot>, "x": <0-100 percentage from left>, "y": <0-100 percentage from top>} pointing to WHERE on the screenshot the issue is visible. If the issue is general and not tied to a specific area, set location to null.`,
    `- Be specific, not generic. Bad: "This could look cleaner." Good: "Primary CTA competes with secondary action due to equal weight and proximity."`,
    `- criticalIssues: 0-5 items (high-impact structural problems)`,
    `- uxImprovements: 0-8 items`,
    `- visualCraftFeedback: 0-6 items`,
    `- accessibilityIssues: 0-5 items`,
    `- productThinking: 0-4 items`,
    `- missedOpportunities: 1-5 items`,
    `- questionsForDesigner: 3-7 items`,
    `- If the design stage is EXPLORATORY, weight structural and product thinking issues higher.`,
    `- If the design stage is FINAL_POLISH, weight visual craft and accessibility higher.`,
    `- Base everything on what you can actually observe in the screenshots.`,
  ].join('\n')
}

// ─── Response parser ──────────────────────────────────────────────────────────

export function parseCritiqueResponse(rawText: string): CritiqueResult {
  // Strip markdown code fences if present
  let text = rawText.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Failed to parse critique response: ${text.slice(0, 200)}`)
    try {
      parsed = JSON.parse(match[0])
    } catch {
      throw new Error(`Failed to parse extracted critique JSON: ${text.slice(0, 200)}`)
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Critique response is not an object')
  }

  const obj = parsed as Record<string, unknown>

  const executiveSummary = obj.executiveSummary as { clarityScore: number; primaryRisk: string; primaryOpportunity: string } | undefined
  if (!executiveSummary || typeof executiveSummary.clarityScore !== 'number') {
    throw new Error('executiveSummary is missing or invalid')
  }

  function parseIssues(arr: unknown): CritiqueIssue[] {
    if (!Array.isArray(arr)) return []
    return arr
      .filter((item): item is Record<string, unknown> =>
        item != null && typeof item === 'object' && typeof (item as Record<string, unknown>).title === 'string'
      )
      .map((item) => ({
        category: String(item.category || '') as CritiqueIssue['category'],
        title: String(item.title || ''),
        description: String(item.description || ''),
        userImpact: String(item.userImpact || ''),
        suggestedFix: String(item.suggestedFix || ''),
        location: item.location && typeof item.location === 'object' && 'x' in (item.location as Record<string, unknown>)
          ? {
              screenshotIndex: Number((item.location as Record<string, unknown>).screenshotIndex) || 0,
              x: Math.max(0, Math.min(100, Number((item.location as Record<string, unknown>).x) || 50)),
              y: Math.max(0, Math.min(100, Number((item.location as Record<string, unknown>).y) || 50)),
            }
          : null,
      }))
  }

  return {
    executiveSummary: {
      clarityScore: Math.max(0, Math.min(100, executiveSummary.clarityScore)),
      primaryRisk: String(executiveSummary.primaryRisk || ''),
      primaryOpportunity: String(executiveSummary.primaryOpportunity || ''),
    },
    criticalIssues: parseIssues(obj.criticalIssues),
    uxImprovements: parseIssues(obj.uxImprovements),
    visualCraftFeedback: parseIssues(obj.visualCraftFeedback),
    accessibilityIssues: parseIssues(obj.accessibilityIssues),
    productThinking: parseIssues(obj.productThinking),
    missedOpportunities: Array.isArray(obj.missedOpportunities)
      ? (obj.missedOpportunities as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
    questionsForDesigner: Array.isArray(obj.questionsForDesigner)
      ? (obj.questionsForDesigner as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
    coachingInsight: typeof obj.coachingInsight === 'string' ? obj.coachingInsight : null,
  }
}

// ─── Image fetcher ───────────────────────────────────────────────────────────

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText} for ${url.slice(0, 100)}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') || 'image/png'
  const mediaType = (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(contentType)
    ? contentType
    : 'image/png') as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

  return { data: buffer.toString('base64'), mediaType }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateCritique(
  context: CritiqueContext,
  imageUrls: string[],
  client?: Anthropic
): Promise<CritiqueResult> {
  const anthropic = getClient(client)
  const systemPrompt = buildCritiquePrompt(context)

  // Download images and convert to base64 to avoid URL expiration issues
  console.log(`[critique] Downloading ${imageUrls.length} image(s)...`)
  const imageContent: Anthropic.Messages.ImageBlockParam[] = await Promise.all(
    imageUrls.map(async (url) => {
      try {
        const { data, mediaType } = await fetchImageAsBase64(url)
        console.log(`[critique] Downloaded image (${mediaType}, ${Math.round(data.length / 1024)}KB base64)`)
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType,
            data,
          },
        }
      } catch (err) {
        console.error(`[critique] Failed to download image, falling back to URL: ${err}`)
        // Fallback to URL-based source
        return {
          type: 'image' as const,
          source: {
            type: 'url' as const,
            url,
          },
        }
      }
    })
  )

  console.log(`[critique] Sending to Claude (model: ${CRITIQUE_MODEL}, max_tokens: 16000)...`)
  const message = await callClaudeWithRetry(() =>
    anthropic.messages.create({
      model: CRITIQUE_MODEL,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: 'Analyze these design screenshots and provide a structured critique based on the context provided.' },
          ],
        },
      ],
    })
  )

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  console.log(`[critique] Response received: stop_reason=${message.stop_reason}, length=${text.length} chars`)

  if (message.stop_reason === 'max_tokens') {
    console.warn(`[critique] WARNING: Response was truncated (max_tokens). Text ends with: ...${text.slice(-100)}`)
  }

  return parseCritiqueResponse(text)
}
