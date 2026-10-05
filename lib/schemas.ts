import { z } from 'zod'

// Employee schemas
export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Ad gerekli'),
  title: z.string().min(1, 'Unvan gerekli'),
  department: z.string().min(1, 'Bölüm gerekli'),
  avatar: z.string().optional(),
  description: z.string().optional(),
  systemRole: z.string().optional(),
  responsibilities: z.string().optional(),
  objectives: z.string().optional(),
  kpis: z.string().optional(),
  dailyRoutine: z.string().optional(),
  weeklyRoutine: z.string().optional(),
  communicationStyle: z.string().optional(),
  decisionRules: z.string().optional(),
  escalationRules: z.string().optional(),
  managerId: z.string().optional(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial()

// Task schemas
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Başlık gerekli'),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.date().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'CANCELLED']).optional(),
})

export const updateTaskSchema = createTaskSchema.partial()

// Instruction schemas
export const createInstructionSchema = z.object({
  employeeId: z.string().min(1, 'Çalışan kimliği gerekli'),
  content: z.string().min(1, 'Talimat içeriği gerekli'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  active: z.boolean().default(true),
  source: z.string().optional(),
})

export const updateInstructionSchema = z.object({
  content: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  active: z.boolean().optional(),
})

// Memory schemas
export const createMemorySchema = z.object({
  employeeId: z.string().optional(),
  content: z.string().min(1, 'Hafıza içeriği gerekli'),
  type: z.enum(['FACT', 'PREFERENCE', 'DECISION', 'CUSTOMER', 'PROCESS', 'LESSON', 'GOAL', 'OTHER']),
  importance: z.number().min(1).max(5).default(1),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

// Meeting schemas
export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Toplantı başlığı gerekli'),
  agenda: z.string().optional(),
  participantIds: z.array(z.string()).min(1, 'En az bir katılımcı gerekli'),
  scheduledFor: z.date().optional(),
})

export const startMeetingSchema = z.object({
  meetingId: z.string().min(1, 'Toplantı kimliği gerekli'),
  agenda: z.string().min(1, 'Gündem gerekli'),
})

// Chat schemas
export const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  content: z.string().min(1, 'Mesaj içeriği gerekli'),
  employeeId: z.string().min(1, 'Çalışan kimliği gerekli'),
})

// Report schemas
export const requestReportSchema = z.object({
  employeeId: z.string().min(1, 'Çalışan kimliği gerekli'),
  type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
})

// Dashboard schemas
export const dashboardSummarySchema = z.object({
  companyId: z.string().min(1, 'Şirket kimliği gerekli'),
})

// Tool execution schemas
export const listTasksInputSchema = z.object({
  employeeId: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().optional(),
})

export const createTaskInputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().optional(),
})

export const updateTaskInputSchema = z.object({
  taskId: z.string(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  description: z.string().optional(),
})

export const searchMemoryInputSchema = z.object({
  query: z.string(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
})

export const addMemoryInputSchema = z.object({
  content: z.string(),
  type: z.enum(['FACT', 'PREFERENCE', 'DECISION', 'CUSTOMER', 'PROCESS', 'LESSON', 'GOAL', 'OTHER']),
  importance: z.number().optional(),
  tags: z.array(z.string()).optional(),
})

export const getCompanySummaryInputSchema = z.object({
  includeRisks: z.boolean().optional(),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type CreateInstructionInput = z.infer<typeof createInstructionSchema>
export type CreateMemoryInput = z.infer<typeof createMemorySchema>
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type RequestReportInput = z.infer<typeof requestReportSchema>
