// Type definitions
type MemoryType = 'FACT' | 'PREFERENCE' | 'DECISION' | 'CUSTOMER' | 'PROCESS' | 'LESSON' | 'GOAL' | 'OTHER'
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE' | 'CANCELLED'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface AIProvider {
  sendMessage(
    messages: AIMessage[],
    tools?: AITool[],
    modelOverride?: string
  ): Promise<AIResponse>
  streamMessage(
    messages: AIMessage[],
    tools?: AITool[],
    modelOverride?: string
  ): AsyncGenerator<AIStreamChunk>
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  content: string
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  toolUses?: AIToolUse[]
}

export interface AIStreamChunk {
  type: 'text' | 'tool_use' | 'end'
  content?: string
  toolUse?: AIToolUse
}

export interface AIToolUse {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface AITool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

export interface AgentContext {
  employeeId: string
  employeeName: string
  employeeTitle: string
  employeeDepartment: string
  systemRole: string
  responsibilities?: string
  objectives?: string
  kpis?: string
  dailyRoutine?: string
  weeklyRoutine?: string
  communicationStyle?: string
  decisionRules?: string
  escalationRules?: string
  permissions: string[]
  instructions: string[]
  relevantMemory: MemoryEntry[]
  currentTasks: TaskSummary[]
  recentReports: ReportSummary[]
  companyContext: CompanyContextData
  conversationHistory: AIMessage[]
  meetingContext?: MeetingContextData
}

export interface MemoryEntry {
  content: string
  type: MemoryType
  importance: number
  source?: string
  tags: string[]
  createdAt: Date
}

export interface TaskSummary {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: Date
  assigneeName?: string
}

export interface ReportSummary {
  id: string
  type: string
  summary?: string
  createdAt: Date
}

export interface CompanyContextData {
  companyName: string
  companyDescription?: string
  totalEmployees: number
  activeTasks: number
  overdueTasks: number
  risksCount: number
  recentMemory: string[]
}

export interface MeetingContextData {
  meetingId: string
  title: string
  agenda?: string
  participants: string[]
  previousMessages: AIMessage[]
}

export interface ToolResult {
  toolName: string
  result: unknown
  error?: string
}

export interface ToolInput {
  [key: string]: unknown
}
