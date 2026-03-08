import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'

function parseFigmaUrl(url: string): { fileKey: string; nodeId: string | null } | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('figma.com')) return null

    // figma.com/design/:fileKey/:fileName?node-id=X-Y
    // figma.com/file/:fileKey/:fileName?node-id=X-Y
    const pathParts = u.pathname.split('/').filter(Boolean)
    const designIdx = pathParts.indexOf('design')
    const fileIdx = pathParts.indexOf('file')
    const idx = designIdx !== -1 ? designIdx : fileIdx
    if (idx === -1 || idx + 1 >= pathParts.length) return null

    const fileKey = pathParts[idx + 1]
    const nodeIdParam = u.searchParams.get('node-id')
    const nodeId = nodeIdParam ? nodeIdParam.replace(/-/g, ':') : null

    return { fileKey, nodeId }
  } catch {
    return null
  }
}

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  _managerId: string
) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed')
  }

  const { figmaUrl } = req.body
  if (!figmaUrl || typeof figmaUrl !== 'string') {
    return sendError(res, 400, 'figmaUrl is required')
  }

  const parsed = parseFigmaUrl(figmaUrl)
  if (!parsed) {
    return sendError(res, 400, 'Invalid Figma URL')
  }

  const figmaToken = process.env.FIGMA_ACCESS_TOKEN
  if (!figmaToken) {
    return sendError(res, 500, 'Figma API token not configured. Add FIGMA_ACCESS_TOKEN to .env.local')
  }

  try {
    // Request rendered image from Figma API
    const idsParam = parsed.nodeId || '0:1'
    const apiUrl = `https://api.figma.com/v1/images/${parsed.fileKey}?ids=${encodeURIComponent(idsParam)}&format=png&scale=2`

    const figmaRes = await fetch(apiUrl, {
      headers: { 'X-Figma-Token': figmaToken },
    })

    if (!figmaRes.ok) {
      const text = await figmaRes.text()
      console.error('[figma-screenshot] API error:', figmaRes.status, text)
      return sendError(res, 500, 'Figma API request failed. Check your access token and URL.')
    }

    const data = await figmaRes.json() as { images: Record<string, string | null> }

    const images = Object.values(data.images || {}).filter(Boolean) as string[]
    if (images.length === 0) {
      return sendError(res, 422, 'No images returned for this Figma node. Try a different node or URL.')
    }

    return res.status(200).json({ imageUrls: images })
  } catch (err) {
    console.error('[figma-screenshot] error:', err)
    return sendError(res, 500, INTERNAL_ERROR)
  }
})
