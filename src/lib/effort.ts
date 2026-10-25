import { defineMessages, useMessages } from '@/lib/i18n'

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

const messages = defineMessages({
  vi: { low: 'Thấp', medium: 'Vừa', high: 'Cao', xhigh: 'Rất cao', max: 'Tối đa' },
  en: { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Very high', max: 'Max' },
})

export function useEffortLabels(): Record<Effort, string> {
  return useMessages(messages)
}

export function isEffort(value: unknown): value is Effort {
  return EFFORTS.includes(value as Effort)
}

const descriptions = defineMessages({
  vi: {
    low: 'Nhanh, gần như không suy luận. Tra cứu, dịch.',
    medium: 'Suy luận nhẹ. Hỏi đáp, tóm tắt, viết ngắn.',
    high: 'Cân bằng. Code, phân tích nhiều bước.',
    xhigh: 'Kỹ hơn, chậm hơn. Debug khó, thiết kế hệ thống.',
    max: 'Sâu nhất, tốn token nhất. Bài toán rất khó.',
  },
  en: {
    low: 'Fast, minimal reasoning. Lookups, translation.',
    medium: 'Light reasoning. Everyday chat, summaries.',
    high: 'Balanced. Coding, multi-step analysis.',
    xhigh: 'Slower, more careful. Hard debugging, design.',
    max: 'Deepest and costliest. Very hard problems.',
  },
})

export function useEffortDescriptions(): Record<Effort, string> {
  return useMessages(descriptions)
}
