import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import type { NextPage } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import FileUploader from '@/components/insights/FileUploader'
import SheetSelector from '@/components/insights/SheetSelector'
import SchemaMapper from '@/components/insights/SchemaMapper'
import AnalysisHistory from '@/components/insights/AnalysisHistory'
import { withAuth, WithAuthProps } from '@/lib/withAuth'
import type { SchemaMapping } from '@/lib/excel/parser'

interface InsightsIndexProps extends WithAuthProps {
  managerEmail: string
}

interface HistoryItem {
  id: string
  filename: string
  sheetName: string | null
  rowCount: number
  analysedAt: string
}

interface SheetSelectionState {
  sheetNames: string[]
  file: File
}

interface MappingState {
  columns: string[]
  detectedSchema: SchemaMapping
  sheetNames: string[]
  selectedSheet: string
  file: File
}

const InsightsIndexPage: NextPage<InsightsIndexProps> = ({ managerEmail }) => {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetSelectionState, setSheetSelectionState] = useState<SheetSelectionState | null>(null)
  const [mappingState, setMappingState] = useState<MappingState | null>(null)

  useEffect(() => {
    fetch('/api/insights')
      .then((r) => r.json())
      .then((d) => setHistory(d.analyses ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false))
  }, [])

  async function uploadFile(file: File, schemaOverride?: Partial<SchemaMapping>, sheetName?: string) {
    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    if (sheetName) fd.append('sheetName', sheetName)
    if (schemaOverride) fd.append('schemaOverride', JSON.stringify(schemaOverride))

    try {
      const res = await fetch('/api/insights/upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
        return
      }

      if (data.needsSheetSelection) {
        setSheetSelectionState({ sheetNames: data.sheetNames, file })
        return
      }

      if (data.needsMapping) {
        setMappingState({ columns: data.columns, detectedSchema: data.detectedSchema, sheetNames: data.sheetNames, selectedSheet: data.selectedSheet, file })
        return
      }

      router.push(`/insights/${data.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleFile(file: File) {
    setSheetSelectionState(null)
    setMappingState(null)
    uploadFile(file)
  }

  function handleSheetSelect(sheetName: string) {
    if (!sheetSelectionState) return
    const file = sheetSelectionState.file
    setSheetSelectionState(null)
    uploadFile(file, undefined, sheetName)
  }

  function handleMappingSubmit(mapping: Partial<SchemaMapping>, sheetName: string) {
    if (!mappingState) return
    setMappingState(null)
    uploadFile(mappingState.file, mapping, sheetName)
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Excel Insights</h1>
          <p className="text-sm text-gray-500 mt-1">Upload an Excel or CSV file to generate an AI-powered dashboard and insights.</p>
        </div>

        {uploading ? (
          <div data-testid="upload-loading" className="flex flex-col items-center py-16 text-gray-500">
            <div className="w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-sm">Analysing your data…</p>
          </div>
        ) : sheetSelectionState ? (
          <SheetSelector
            sheetNames={sheetSelectionState.sheetNames}
            onSelect={handleSheetSelect}
          />
        ) : mappingState ? (
          <SchemaMapper
            columns={mappingState.columns}
            detectedSchema={mappingState.detectedSchema}
            sheetNames={mappingState.sheetNames}
            selectedSheet={mappingState.selectedSheet}
            onSubmit={handleMappingSubmit}
          />
        ) : (
          <FileUploader onFile={handleFile} disabled={uploading} />
        )}

        {error && (
          <p data-testid="upload-error" className="text-sm text-red-600">{error}</p>
        )}

        {loadingHistory ? (
          <div className="text-center text-gray-400 text-sm py-6">Loading history…</div>
        ) : (
          <AnalysisHistory analyses={history} />
        )}
      </div>
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(InsightsIndexPage, async (_ctx, managerId) => {
  const { prisma } = await import('@/lib/prisma')
  const manager = await prisma.manager.findUnique({ where: { id: managerId }, select: { email: true } })
  return { props: { managerEmail: manager?.email ?? '' } }
})
export default _page
export const getServerSideProps = _getServerSideProps
