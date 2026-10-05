import { AITool } from '@/lib/types'

export const agentTools: AITool[] = [
  {
    name: 'list_tasks',
    description: 'List tasks assigned to the current employee or filter by status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by task status: TODO, IN_PROGRESS, BLOCKED, REVIEW, DONE, CANCELLED',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return (default: 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task and assign it to someone',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title',
        },
        description: {
          type: 'string',
          description: 'Detailed task description',
        },
        assigneeId: {
          type: 'string',
          description: 'ID of employee to assign task to',
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'Task priority level',
        },
        dueDate: {
          type: 'string',
          description: 'Due date in ISO 8601 format',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task status, priority, or description',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to update',
        },
        status: {
          type: 'string',
          enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'CANCELLED'],
          description: 'New task status',
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'New priority level',
        },
        description: {
          type: 'string',
          description: 'Updated task description',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'search_employee_memory',
    description: 'Search employee memory for relevant information',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query or keywords',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags to filter by',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_employee_memory',
    description: 'Add a new memory entry for the employee',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Memory content',
        },
        type: {
          type: 'string',
          enum: ['FACT', 'PREFERENCE', 'DECISION', 'CUSTOMER', 'PROCESS', 'LESSON', 'GOAL', 'OTHER'],
          description: 'Type of memory',
        },
        importance: {
          type: 'number',
          description: 'Importance level 1-5',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
      },
      required: ['content', 'type'],
    },
  },
  {
    name: 'get_company_summary',
    description: 'Get a summary of current company status and metrics',
    inputSchema: {
      type: 'object',
      properties: {
        includeRisks: {
          type: 'boolean',
          description: 'Include open risks in the summary',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_employee_report',
    description: 'Generate or retrieve an employee report',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: {
          type: 'string',
          description: 'ID of employee to report on',
        },
        type: {
          type: 'string',
          enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
          description: 'Type of report',
        },
      },
      required: ['employeeId', 'type'],
    },
  },
  {
    name: 'create_meeting_action',
    description: 'Create an action item from a meeting discussion',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: {
          type: 'string',
          description: 'ID of the meeting',
        },
        content: {
          type: 'string',
          description: 'Action item description',
        },
        assigneeId: {
          type: 'string',
          description: 'Optional: ID of employee to assign to',
        },
      },
      required: ['meetingId', 'content'],
    },
  },
]

export function getToolByName(name: string): AITool | undefined {
  return agentTools.find((tool) => tool.name === name)
}
