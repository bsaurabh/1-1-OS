import { useEffect, useRef, useState } from 'react'
import TranscriptionReview from './TranscriptionReview'

interface VoiceRecorderProps {
  teammateId: string
  onSuccess: (meetingId: string) => void
}

type RecorderState =
  | 'IDLE'
  | 'REQUESTING'
  | 'RECORDING'
  | 'UPLOADING'
  | 'TRANSCRIBING'
  | 'REVIEW'
  | 'ERROR'

export default function VoiceRecorder({ teammateId, onSuccess }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('IDLE')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [transcription, setTranscription] = useState('')
  const [fileId, setFileId] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  async function startRecording() {
    setState('REQUESTING')
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => handleRecordingStop(stream)

      recorder.start()
      setState('RECORDING')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setState('ERROR')
      setErrorMsg('Microphone access denied. Please allow microphone access and try again.')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  async function handleRecordingStop(stream: MediaStream) {
    stream.getTracks().forEach((t) => t.stop())
    setState('UPLOADING')

    try {
      // Get presigned upload URL
      const startRes = await fetch('/api/transcription/start')
      if (!startRes.ok) throw new Error('Failed to get upload URL')
      const { uploadUrl, fileId: fid } = await startRes.json()
      setFileId(fid)

      // Upload audio blob to Supabase Storage
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: audioBlob,
        headers: { 'Content-Type': 'audio/webm' },
      })
      if (!uploadRes.ok) throw new Error('Failed to upload audio')

      setState('TRANSCRIBING')

      // Transcribe via Whisper
      const transcribeRes = await fetch('/api/transcription/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fid }),
      })
      if (!transcribeRes.ok) throw new Error('Transcription failed')
      const { text } = await transcribeRes.json()

      setTranscription(text)
      setState('REVIEW')
    } catch (err) {
      setState('ERROR')
      setErrorMsg((err as Error).message ?? 'Something went wrong')
    }
  }

  function handleDiscard() {
    setState('IDLE')
    setSeconds(0)
    setTranscription('')
    setFileId('')
    setErrorMsg(null)
  }

  if (state === 'REVIEW') {
    return (
      <TranscriptionReview
        teammateId={teammateId}
        fileId={fileId}
        initialText={transcription}
        onSuccess={onSuccess}
        onDiscard={handleDiscard}
      />
    )
  }

  return (
    <div data-testid="voice-recorder" className="space-y-4">
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        {state === 'RECORDING' && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <span data-testid="recording-timer" className="font-mono text-lg font-semibold text-gray-800">
              {formatTime(seconds)}
            </span>
          </div>
        )}

        {(state === 'UPLOADING' || state === 'TRANSCRIBING') && (
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">
              {state === 'UPLOADING' ? 'Uploading recording…' : 'Transcribing audio…'}
            </span>
          </div>
        )}

        {state === 'IDLE' || state === 'REQUESTING' ? (
          <button
            data-testid="record-start"
            onClick={startRecording}
            disabled={state === 'REQUESTING'}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 disabled:opacity-50"
          >
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm-1 1.93V18H9v2h6v-2h-2v-2.07A7.004 7.004 0 0019 11h-2a5 5 0 01-10 0H5a7.004 7.004 0 006 6.93z" />
            </svg>
          </button>
        ) : state === 'RECORDING' ? (
          <button
            data-testid="record-stop"
            onClick={stopRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-900"
          >
            <span className="h-5 w-5 rounded-sm bg-white" />
          </button>
        ) : null}

        <p className="text-xs text-gray-500">
          {state === 'IDLE' && 'Tap the microphone to start recording'}
          {state === 'REQUESTING' && 'Requesting microphone access…'}
          {state === 'RECORDING' && 'Recording… tap stop when done'}
        </p>
      </div>

      {state === 'ERROR' && (
        <div data-testid="recorder-error" className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button
            onClick={handleDiscard}
            className="mt-2 text-xs text-red-600 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
