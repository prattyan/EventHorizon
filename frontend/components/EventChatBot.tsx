import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Loader2, Sparkles, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { Event } from '../types';
import {
    chatWithAI,
    streamChatWithAI,
    getGeminiStatus,
    onGeminiStatusChange,
    checkGeminiHealth,
    GeminiStatusState
} from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface EventChatBotProps {
    events: Event[];
    currentUserId?: string;
}

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

const EventChatBot: React.FC<EventChatBotProps> = ({ events, currentUserId }) => {
    const [statusState, setStatusState] = useState<GeminiStatusState>(getGeminiStatus());
    const [isOpen, setIsOpen] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    const isOnline = statusState.isOnline;
    const isChecking = statusState.status === 'checking';

    const getInitialMessage = (currentStatus: GeminiStatusState): Message => ({
        id: 'welcome',
        text: currentStatus.isOnline
            ? "Hi! I'm your Eventron AI assistant. Ask me anything about our upcoming events!"
            : `**AI Assistant Offline**\n\n${currentStatus.errorMessage || 'The Gemini API is inactive, suspended, or unconfigured.'
            }\n\nTo enable the AI assistant, please ensure an active \`VITE_GEMINI_API_KEY\` is configured in your \`.env\` file.`,
        sender: 'bot',
        timestamp: new Date()
    });

    const [messages, setMessages] = useState<Message[]>([getInitialMessage(statusState)]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatWindowRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Prevent background page from scrolling up/down when cursor is over the chatbot
    useEffect(() => {
        const chatEl = chatWindowRef.current;
        if (!isOpen || !chatEl) return;

        const handleWheel = (e: WheelEvent) => {
            const messagesEl = messagesContainerRef.current;
            if (!messagesEl) {
                e.preventDefault();
                return;
            }

            // If wheeling over non-scrollable parts of chatbot (header, input, alert banner, etc.)
            if (!messagesEl.contains(e.target as Node)) {
                e.preventDefault();
                return;
            }

            // Inside messages container: isolate scroll and prevent propagation to background
            const { scrollTop, scrollHeight, clientHeight } = messagesEl;
            const isScrollable = scrollHeight > clientHeight;

            if (!isScrollable) {
                e.preventDefault();
                return;
            }

            const isScrollingDown = e.deltaY > 0;
            const isScrollingUp = e.deltaY < 0;

            // Reached bottom and attempting to scroll down
            if (isScrollingDown && Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1) {
                e.preventDefault();
                return;
            }

            // Reached top and attempting to scroll up
            if (isScrollingUp && scrollTop <= 0) {
                e.preventDefault();
                return;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            const messagesEl = messagesContainerRef.current;
            if (!messagesEl || !messagesEl.contains(e.target as Node)) {
                e.preventDefault();
            }
        };

        chatEl.addEventListener('wheel', handleWheel, { passive: false });
        chatEl.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            chatEl.removeEventListener('wheel', handleWheel);
            chatEl.removeEventListener('touchmove', handleTouchMove);
        };
    }, [isOpen]);

    // Subscribe to status changes from geminiService
    useEffect(() => {
        const unsubscribe = onGeminiStatusChange((newStatus) => {
            setStatusState(newStatus);
        });

        // Trigger health check on mount
        checkGeminiHealth();

        return unsubscribe;
    }, []);

    // Reset Chat on User Change (Logout/Login) or when status transitions from offline to online
    useEffect(() => {
        setMessages([getInitialMessage(statusState)]);
    }, [currentUserId, statusState.isOnline]);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            // Recheck if it was in checking state or opened
            if (!statusState.isOnline && !isChecking) {
                checkGeminiHealth();
            }
        }
    }, [messages, isOpen]);

    const handleRetryCheck = async () => {
        setIsRetrying(true);
        try {
            await checkGeminiHealth(true);
        } finally {
            setIsRetrying(false);
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || isLoading || !isOnline) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsLoading(true);

        const botMsgId = (Date.now() + 1).toString();
        let hasStartedStreaming = false;

        try {
            // Prepare context from events
            const context = events.map(e => ({
                title: e.title,
                date: e.date,
                location: e.location,
                description: e.description,
                type: e.locationType || 'offline',
                isPaid: e.isPaid,
                price: e.price,
                capacity: e.capacity
            }));

            await streamChatWithAI(userMsg.text, context, (_chunk, fullTextSoFar) => {
                if (!hasStartedStreaming) {
                    hasStartedStreaming = true;
                    setIsLoading(false);
                    setMessages(prev => [
                        ...prev,
                        {
                            id: botMsgId,
                            text: fullTextSoFar,
                            sender: 'bot',
                            timestamp: new Date()
                        }
                    ]);
                } else {
                    setMessages(prev =>
                        prev.map(m => m.id === botMsgId ? { ...m, text: fullTextSoFar } : m)
                    );
                }
            });
        } catch (error) {
            setIsLoading(false);
            if (!hasStartedStreaming) {
                const errorMsg: Message = {
                    id: botMsgId,
                    text: "Sorry, I encountered an error processing your question. Please try again.",
                    sender: 'bot',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsOpen(true)}
                        title={
                            isOnline
                                ? "Eventron AI Assistant (Online)"
                                : isChecking
                                    ? "Eventron AI Assistant (Checking Status...)"
                                    : `Eventron AI Assistant (Offline: ${statusState.errorMessage || 'API Inactive'})`
                        }
                        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-orange-600 to-amber-600 rounded-full shadow-lg shadow-orange-600/30 flex items-center justify-center text-white border border-white/10 group"
                    >
                        <Sparkles className={`w-6 h-6 ${isOnline ? 'animate-pulse' : 'opacity-70'}`} />
                        <div
                            className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 shadow-sm ${isOnline
                                    ? 'bg-emerald-500 animate-pulse'
                                    : isChecking
                                        ? 'bg-amber-400 animate-pulse'
                                        : 'bg-rose-500'
                                }`}
                            title={isOnline ? "Online" : isChecking ? "Checking..." : "Offline"}
                        />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={chatWindowRef}
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-[380px] h-[500px] max-h-[80vh] bg-slate-900 rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden overscroll-contain"
                        style={{ overscrollBehavior: 'contain' }}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-600/20 rounded-full flex items-center justify-center border border-orange-500/20">
                                    <Bot className="w-6 h-6 text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Eventron Assistant</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className={`w-2 h-2 rounded-full ${isOnline
                                                    ? 'bg-emerald-500 animate-pulse'
                                                    : isChecking
                                                        ? 'bg-amber-400 animate-pulse'
                                                        : 'bg-rose-500'
                                                }`}
                                        />
                                        <span
                                            className={`text-[10px] font-semibold ${isOnline
                                                    ? 'text-emerald-400'
                                                    : isChecking
                                                        ? 'text-amber-400'
                                                        : 'text-rose-400'
                                                }`}
                                        >
                                            {isOnline ? 'Online' : isChecking ? 'Checking...' : 'Offline'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {!isOnline && (
                                    <button
                                        onClick={handleRetryCheck}
                                        disabled={isRetrying || isChecking}
                                        className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                                        title="Check API Status"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isRetrying || isChecking ? 'animate-spin' : ''}`} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                                    title="Close chat"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Offline Alert Banner */}
                        {!isOnline && !isChecking && (
                            <div className="bg-rose-950/50 border-b border-rose-500/20 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-rose-300">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-semibold text-rose-200">
                                        {statusState.reason === 'missing_key'
                                            ? 'Gemini API Not Configured'
                                            : statusState.reason === 'suspended_account'
                                                ? 'Gemini API Inactive / Suspended'
                                                : 'Gemini API Offline'}
                                    </p>
                                    <p className="text-[11px] text-rose-300/80 leading-snug mt-0.5">
                                        {statusState.errorMessage || 'The configured API key is not active. Please check your .env file.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Messages Area */}
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/50 overscroll-contain"
                            style={{ overscrollBehavior: 'contain' }}
                        >
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${msg.sender === 'user'
                                                ? 'bg-orange-600 text-white rounded-tr-none'
                                                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                                            }`}
                                    >
                                        {msg.sender === 'user' ? (
                                            msg.text
                                        ) : (
                                            <ReactMarkdown
                                                components={{
                                                    strong: ({ node, ...props }: any) => (
                                                        <span className="font-bold text-orange-400" {...props} />
                                                    ),
                                                    p: ({ node, ...props }: any) => (
                                                        <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
                                                    ),
                                                    ul: ({ node, ...props }: any) => (
                                                        <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />
                                                    ),
                                                    li: ({ node, ...props }: any) => (
                                                        <li className="pl-1" {...props} />
                                                    ),
                                                    a: ({ node, ...props }: any) => (
                                                        <a
                                                            className="text-orange-400 underline hover:text-orange-300"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            {...props}
                                                        />
                                                    ),
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        )}
                                        <div
                                            className={`text-[10px] mt-1 opacity-50 ${msg.sender === 'user' ? 'text-orange-200' : 'text-slate-400'
                                                }`}
                                        >
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                                        <span className="text-xs text-slate-400">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-white/5">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder={
                                        isOnline
                                            ? "Ask about events..."
                                            : isChecking
                                                ? "Checking Gemini API status..."
                                                : "Chat unavailable (Gemini API Offline)"
                                    }
                                    disabled={!isOnline || isLoading || isChecking}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-orange-500 transition-colors placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim() || isLoading || !isOnline || isChecking}
                                    className="bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center disabled:cursor-not-allowed"
                                    title={isOnline ? "Send message" : "AI Assistant Offline"}
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-slate-500">
                                    {isOnline
                                        ? "AI can make mistakes. Verify info."
                                        : "Configure an active VITE_GEMINI_API_KEY in .env to enable AI chat."}
                                </p>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default EventChatBot;
