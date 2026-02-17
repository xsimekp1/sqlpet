'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, User, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ApiClient } from '@/lib/api';

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

interface OrgUser {
  id: string;
  name: string;
  full_name: string | null;
  avatar_url: string | null;
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
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newConvDialogOpen, setNewConvDialogOpen] = useState(false);
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

  const loadOrgUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await ApiClient.get<OrgUser[]>('/chat/users');
      if (data.length === 0) {
        toast.info(t('chat.noUsersInOrg'));
        return;
      }
      setOrgUsers(data);
    } catch (err: any) {
      toast.error(t('chat.errors.loadUsers'));
    } finally {
      setUsersLoading(false);
    }
  };

  const openNewConvDialog = async () => {
    await loadOrgUsers();
    if (orgUsers.length === 0) {
      toast.warning(t('chat.needTwoMembers'));
      return;
    }
    setNewConvDialogOpen(true);
  };

  const startConversation = (user: OrgUser) => {
    setSelectedPartner(user.id);
    setNewConvDialogOpen(false);
  };

  const loadConversations = async () => {
    try {
      const data = await ApiClient.get<Conversation[]>('/chat/conversations');
      setConversations(data);
    } catch (err: any) {
      toast.error(t('chat.errors.loadConversations'));
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (partnerId: string) => {
    setLoadingMessages(true);
    try {
      const data = await ApiClient.get<Message[]>(`/chat/messages/${partnerId}`);
      setMessages(data);
    } catch (err: any) {
      toast.error(t('chat.errors.loadMessages'));
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPartner) return;
    setSending(true);
    try {
      await ApiClient.post('/chat/messages', {
        recipient_id: selectedPartner,
        content: newMessage,
      });
      setNewMessage('');
      loadMessages(selectedPartner);
      loadConversations();
    } catch (error: any) {
      toast.error(t('chat.errors.sendMessage'));
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
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('chat.title')}</h2>
          <Dialog open={newConvDialogOpen} onOpenChange={setNewConvDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" onClick={openNewConvDialog}>
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('chat.newConversation')}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[400px] overflow-y-auto">
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : orgUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">{t('chat.noUsersInOrg')}</p>
                ) : (
                  <div className="divide-y">
                    {orgUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => startConversation(user)}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3"
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{user.full_name || user.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="h-[calc(100vh-130px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">{t('chat.noConversations')}</p>
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
                {conversations.find(c => c.partner_id === selectedPartner)?.partner_name || 
                 orgUsers.find(u => u.id === selectedPartner)?.full_name || 
                 orgUsers.find(u => u.id === selectedPartner)?.name || 
                 'Nová konverzace'}
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
                  <p className="text-sm">{t('chat.noMessages')}</p>
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
                  placeholder={t('chat.typeMessage')}
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
            <p>{t('chat.selectConversation')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
