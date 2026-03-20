import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/withAuth'
import { sendError, INTERNAL_ERROR } from '@/lib/apiError'
import { parseExcelBuffer } from '@/lib/excel/parser'
import { computeMetrics } from '@/lib/excel/metrics'
import { generateInsights } from '@/handlers/excelInsightsHandler'
import formidable from 'formidable'
import fs from 'fs'
import * as XLSX from 'xlsx'

export const config = { api: { bodyParser: false } }

export default withAuth(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  managerId: string
) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed')

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
    const [fields, files] = await form.parse(req)

    const fileArr = files.file
    if (!fileArr || fileArr.length === 0) return sendError(res, 400, 'No file uploaded')

    const file = fileArr[0]
    const ext = file.originalFilename?.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'csv', 'xls'].includes(ext)) {
      return sendError(res, 400, 'Only .xlsx, .xls, and .csv files are supported')
    }

    const buffer = fs.readFileSync(file.filepath)

    const sheetName = Array.isArray(fields.sheetName) ? fields.sheetName[0] : fields.sheetName ?? undefined
    const schemaOverrideRaw = Array.isArray(fields.schemaOverride) ? fields.schemaOverride[0] : fields.schemaOverride
    const schemaOverride = schemaOverrideRaw ? JSON.parse(schemaOverrideRaw) : undefined

    // If no sheet was chosen yet, peek at sheet names (sheetRows:1 is fast)
    // and ask the user to pick one when the workbook has multiple sheets.
    if (!sheetName) {
      const wb = XLSX.read(buffer, { type: 'buffer', sheetRows: 1 })
      if (wb.SheetNames.length > 1) {
        return res.status(200).json({
          needsSheetSelection: true,
          sheetNames: wb.SheetNames,
        })
      }
    }

    const parsed = parseExcelBuffer(buffer, { sheetName, schemaOverride })

    // If key columns couldn't be detected, ask the user to map them
    if (parsed.needsMapping && !schemaOverride) {
      return res.status(200).json({
        needsMapping: true,
        columns: parsed.columns,
        detectedSchema: parsed.detectedSchema,
        sheetNames: parsed.sheetNames,
        selectedSheet: parsed.selectedSheet,
      })
    }

    const metrics = computeMetrics(parsed.rows)
    const { insights, recommendations } = await generateInsights(metrics, parsed.rows.length)

    const { prisma } = await import('@/lib/prisma')
    const analysis = await prisma.excelAnalysis.create({
      data: {
        managerId,
        filename: file.originalFilename ?? 'upload',
        sheetName: parsed.selectedSheet,
        rowCount: parsed.rows.length,
        schemaMapping: parsed.detectedSchema as object,
        metrics: metrics as object,
        insights: insights as unknown as object,
        recommendations: recommendations as unknown as object,
      },
    })

    return res.status(201).json({
      id: analysis.id,
      metrics,
      insights,
      recommendations,
      schemaMapping: parsed.detectedSchema,
      sheetNames: parsed.sheetNames,
      rowCount: parsed.rows.length,
    })
  } catch (err) {
    console.error('[insights/upload] error:', err)
    return sendError(res, 500, INTERNAL_ERROR)
  }
})
