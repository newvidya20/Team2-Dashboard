import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  CheckCircle2,
  ListTodo,
  User,
  ArrowRight,
  Maximize2,
  Minimize2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TaskItem, DailyReport, UserProfile, ActivityLog } from '../types';
import { createTask, logActivity } from '../services/db';
import { apiRequest } from '../services/api';
import { resolveMemberEmail } from '../services/notificationService';
import { getLocalDateKey } from '../utils/date';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdTask?: any;
  timestamp: string;
}

interface ChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
  tasks: TaskItem[];
  dailyReports: DailyReport[];
  teamMembers: UserProfile[];
  activityLogs: ActivityLog[];
  onTaskCreated?: () => void;
}

export const Chatbot: React.FC<ChatbotProps> = ({
  isOpen,
  onToggle,
  tasks,
  dailyReports,
  teamMembers,
  activityLogs,
  onTaskCreated,
}) => {
  const { userProfile, isAdmin } = useAuth();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Hello ${userProfile?.displayName ? userProfile.displayName.split(' ')[0] : 'there'}! 👋 I am **Team 2 AI**, connected to the latest dashboard data and activity history. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickPrompts = isAdmin
    ? [
        'What’s new today?',
        'Who is facing problems?',
        'What did everyone complete?',
        'What changed this week?',
        'Which tasks are overdue?',
      ]
    : [
        'What’s new in my tasks?',
        'What blockers have I reported?',
        'What did I complete?',
        'Summarize my week',
        'Which of my tasks are overdue?',
      ];

  const handleSend = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || loading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Chat history format for API
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const data = await apiRequest<{ reply?: string; createdTask?: any }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: promptText,
          history,
        }),
      });

      let createdTaskPayload = null;
      // If AI decided to create a task via function calling
      if (data.createdTask && userProfile) {
        const t = data.createdTask;
        // Match member name or email
        const targetSearch = (t.assignedToName || '').toLowerCase();
        const matchedAssignee =
          teamMembers.find(
            (m) =>
              m.displayName.toLowerCase().includes(targetSearch) ||
              (m.email && m.email.toLowerCase().includes(targetSearch))
          ) || userProfile;
        const assignee = isAdmin ? matchedAssignee : userProfile;

        const { email: assigneeEmail } = resolveMemberEmail(assignee, teamMembers);

        const newTask = await createTask(
          {
            title: t.title || 'Lead assessment task',
            description: t.description || 'Created via Team 2 AI Assistant',
            assignedTo: assignee.uid,
            assignedToName: assignee.displayName,
            assigneeEmail,
            createdBy: userProfile.uid,
            createdByName: `${userProfile.displayName} (via AI)`,
            priority: t.priority || 'medium',
            status: 'todo',
            dueDate: t.dueDate || getLocalDateKey(),
          },
          userProfile
        );

        await logActivity(
          userProfile,
          'ai_task_created',
          `Team 2 AI created task "${newTask.title}" for ${assignee.displayName} (${assigneeEmail})`
        );

        createdTaskPayload = newTask;
        if (onTaskCreated) onTaskCreated();
      }

      let replyContent = data.reply || 'Task processed successfully.';
      if (createdTaskPayload) {
        replyContent += `\n\nThe task was added to the queue. No email was sent.`;
      }

      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'model',
        text: replyContent,
        createdTask: createdTaskPayload,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Failed to chat:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'model',
          text: `I encountered an issue processing your request: ${err.message}. Please check your connection or try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-40 flex items-center space-x-2.5 px-4 py-3.5 rounded-full bg-gradient-to-r from-[#E06610] to-[#F37A1F] text-white font-extrabold text-sm shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all group border-2 border-white/40"
          title="Ask Me"
        >
          <img
            src="/robot-assistant.svg"
            alt=""
            className="w-9 h-9 object-contain transition-transform group-hover:-rotate-6"
          />
          <span>Ask Me</span>
        </button>
      )}

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-white shadow-2xl border border-stone-200/90 flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'inset-2 sm:inset-4 lg:left-[calc(16rem+1.5rem)] lg:right-6 lg:top-24 lg:bottom-6 rounded-2xl'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[95vw] sm:w-[420px] h-[580px] max-h-[85vh] rounded-3xl'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0F1D38] to-[#1E293B] text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#F37A1F] flex items-center justify-center text-white shadow-xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="font-extrabold text-sm">Team 2 AI</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <p className="text-[10px] text-stone-300">Live dashboard data & history</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsExpanded((expanded) => !expanded)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition"
                title={isExpanded ? 'Restore chat size' : 'Expand chat'}
                aria-label={isExpanded ? 'Restore chat size' : 'Expand chat'}
                aria-pressed={isExpanded}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() =>
                  setMessages([
                    {
                      id: 'welcome',
                      role: 'model',
                      text: `Chat reset. How can I help you, ${userProfile?.displayName}?`,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ])
                }
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition"
                title="Clear conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsExpanded(false);
                  onToggle();
                }}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div className="bg-stone-50 border-b border-stone-100 px-3 py-2 flex items-center space-x-2 overflow-x-auto scrollbar-none">
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="shrink-0 px-2.5 py-1 rounded-full bg-white border border-stone-200 text-[11px] font-semibold text-stone-700 hover:border-orange-400 hover:text-[#F37A1F] transition shadow-2xs"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FBF9F5]">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-[#F37A1F] text-white rounded-br-xs shadow-xs'
                        : 'bg-white text-[#0F1D38] border border-stone-200/80 rounded-bl-xs shadow-2xs'
                    }`}
                  >
                    <div className="whitespace-pre-line break-words font-sans">
                      {m.text}
                    </div>

                    {/* AI-created task card confirmation */}
                    {m.createdTask && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-[#0F1D38] text-[11px]">
                        <div className="flex items-center space-x-1.5 font-bold text-[#F37A1F] mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Task Added to Dashboard!</span>
                        </div>
                        <p className="font-bold">{m.createdTask.title}</p>
                        <p className="text-stone-500">
                          Assigned to: {m.createdTask.assignedToName} • Due: {m.createdTask.dueDate}
                        </p>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-stone-400 mt-0.5 px-1">{m.timestamp}</span>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center space-x-2 text-stone-500 bg-white border border-stone-200 rounded-2xl p-3 w-fit text-xs">
                <Loader2 className="w-4 h-4 text-[#F37A1F] animate-spin" />
                <span>Thinking with live team context...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-stone-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                placeholder="Ask about today, blockers, tasks, reports, or certificates..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F37A1F] bg-stone-50/50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-[#F37A1F] text-white hover:bg-[#df6a14] transition disabled:opacity-50 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
