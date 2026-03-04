interface QuestionListProps {
  questions: string[]
}

export default function QuestionList({ questions }: QuestionListProps) {
  return (
    <ol data-testid="question-list" className="space-y-2 list-none">
      {questions.map((q, i) => (
        <li key={i} data-testid={`question-${i}`} className="flex gap-2 text-sm text-gray-800">
          <span className="text-gray-400 shrink-0 font-medium">{i + 1}.</span>
          <span>{q}</span>
        </li>
      ))}
    </ol>
  )
}
