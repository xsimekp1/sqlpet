'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';

interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  recipient_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export default function ChatPage() {
  const t = useTranslations();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      loadMessages(selectedPartner);
    }
  }, [selectedPartner]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await fetch('/api/chat/conversations').then(r => r.json());
      setConversations(data);
    } catch {
      toast.error('Nepodařilo se načíst konverzace');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (partnerId: string) => {
    setLoadingMessages(true);
    try {
      const data = await fetch(`/api/chat/messages/${partnerId}`).then(r => r.json());
      setMessages(data);
    } catch {
      toast.error('Nepodařilo se načíst zprávy');
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPartner) return;
    setSending(true);
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: selectedPartner,
          content: newMessage,
        }),
      });
      setNewMessage('');
      loadMessages(selectedPartner);
      loadConversations();
    } catch (error: any) {
      toast.error(error.message || 'Nepodařilo se odeslat zprávu');
    } finally {
      setSending(false);
    }
  };

  const getCurrentUserId = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.user_id;
    } catch {
      return null;
    }
  };

  const currentUserId = getCurrentUserId();

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Conversations List */}
      <div className="w-80 border-r bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Zprávy</h2>
        </div>
        <div className="h-[calc(100vh-130px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">Žádné konverzace</p>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => (
                <button
                  key={conv.partner_id}
                  onClick={() => setSelectedPartner(conv.partner_id)}
                  className={`w-full p-4 text-left hover:bg-muted transition-colors ${
                    selectedPartner === conv.partner_id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {conv.partner_avatar ? (
                        <img src={conv.partner_avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{conv.partner_name}</span>
                        {conv.unread_count > 0 && (
                          <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{conv.last_message}</p>
                      <p className="text-xs text-muted-foreground">
                        {conv.last_message_at && format(new Date(conv.last_message_at), 'd.M. HH:mm')}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
            </div>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        {selectedPartner ? (
          <>
            {/* Header */}
            <div className="p-4 border-b bg-card">
              <h3 className="font-semibold">
                {conversations.find(c => c.partner_id === selectedPartner)?.partner_name}
              </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2" />
                  <p className="text-sm">Žádné zprávy</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            isMe
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), 'd.M. HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
        </div>

            {/* Input */}
            <div className="p-4 border-t bg-card">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Napište zprávu..."
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !newMessage.trim()}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4" />
            <p>Vyberte konverzaci</p>
          </div>
        )}
      </div>
    </div>
  );
}
