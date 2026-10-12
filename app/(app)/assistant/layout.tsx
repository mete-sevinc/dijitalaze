import { ReactNode } from 'react'

// Asistan sunucu eylemleri (LLM + araç turları) varsayılandan uzun sürebilir.
export const maxDuration = 60

export default function AssistantLayout({ children }: { children: ReactNode }) {
  return children
}
