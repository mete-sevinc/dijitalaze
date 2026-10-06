'use client'
import { useCompanyId } from '@/components/company-context'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getEmployeeById } from '@/app/actions/employees'
import { sendMessage, getConversations } from '@/app/actions/chat'

interface Employee {
  id: string
  name: string
  title: string
  department: string
  avatar?: string | null
}

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  createdAt: string | Date
}

interface Conversation {
  id: string
  title: string
  updatedAt: string | Date
  messages?: Message[]
}

export default function ChatPage() {
  const companyId = useCompanyId()
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function load() {
      const [empResult, convResult] = await Promise.all([
        getEmployeeById(id),
        getConversations(id),
      ])
      if (empResult.success && empResult.data) setEmployee(empResult.data as Employee)
      if (convResult.success && convResult.data) setConversations(convResult.data as Conversation[])
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || sending) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'USER',
      content: input.trim(),
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)

    const result = await sendMessage(id, companyId, userMessage.content, currentConversationId)

    if (result.success && result.data) {
      const data = result.data as { conversationId: string; response: string; messages?: Message[] }
      setCurrentConversationId(data.conversationId)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ASSISTANT',
        content: data.response,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Update conversation list
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === data.conversationId)
        if (exists) {
          return prev.map((c) =>
            c.id === data.conversationId ? { ...c, updatedAt: new Date() } : c
          )
        }
        return [{ id: data.conversationId, title: userMessage.content.slice(0, 50), updatedAt: new Date() }, ...prev]
      })
    } else {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'SYSTEM',
        content: `Hata: ${result.error || 'Yanıt alınamadı'}`,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }

    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function startNewConversation() {
    setCurrentConversationId(undefined)
    setMessages([])
  }

  if (loading) return <div className="p-8 text-slate-500">Yükleniyor...</div>
  if (!employee) return <div className="p-8 text-red-500">Çalışan bulunamadı</div>

  return (
    <div className="flex h-full">
      {/* Sidebar: conversation history */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-500 hover:text-slate-700 mb-3 flex items-center gap-1"
          >
            ← Geri
          </button>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{employee.avatar || '👤'}</span>
            <div>
              <p className="font-semibold text-sm text-slate-900">{employee.name}</p>
              <p className="text-xs text-slate-500">{employee.title}</p>
            </div>
          </div>
          <button
            onClick={startNewConversation}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            ➕ Yeni Sohbet
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Henüz sohbet yok</p>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setCurrentConversationId(conv.id)
                setMessages([])
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                currentConversationId === conv.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <p className="font-medium truncate">{conv.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(conv.updatedAt).toLocaleDateString('tr-TR')}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
          <span className="text-3xl">{employee.avatar || '👤'}</span>
          <div>
            <h2 className="font-semibold text-slate-900">{employee.name}</h2>
            <p className="text-sm text-slate-500">{employee.title} · {employee.department}</p>
          </div>
          {currentConversationId && (
            <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Sohbet aktif</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <p className="text-5xl">{employee.avatar || '👤'}</p>
              <p className="font-medium text-slate-600">{employee.name} ile sohbet başlatın</p>
              <p className="text-sm">Bir şeyler yazın veya soru sorun</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'ASSISTANT' && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-lg shrink-0 mt-1">
                  {employee.avatar || '👤'}
                </div>
              )}
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'USER'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : msg.role === 'SYSTEM'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-white shadow border border-slate-200 text-slate-800 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'USER' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs shrink-0 mt-1">
                  SİZ
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-lg shrink-0">
                {employee.avatar || '👤'}
              </div>
              <div className="bg-white shadow border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder={`${employee.name}'e mesaj yaz... (Enter gönder, Shift+Enter yeni satır)`}
              className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              style={{ minHeight: '46px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
