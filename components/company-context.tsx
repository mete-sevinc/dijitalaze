'use client'
import { createContext, ReactNode, useContext } from 'react'

const CompanyContext = createContext<string>('')

export function CompanyProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  return <CompanyContext.Provider value={companyId}>{children}</CompanyContext.Provider>
}

export const useCompanyId = () => useContext(CompanyContext)
