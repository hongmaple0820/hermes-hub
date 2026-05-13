'use client';

import { useState } from 'react';
import { useAppStore, Notification } from '@/lib/store';
import { useI18n } from '@/i18n';
import { Bell, Check, CheckCheck, Trash2, Info, CheckCircle, AlertTriangle, XCircle, Radio, LogOut, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'info':
      return <Info className="w-4 h-4 text-blue-500" />;
    case 'success':
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'agent_connected':
      return <Radio className="w-4 h-4 text-cyan-500" />;
    case 'agent_disconnected':
      return <LogOut className="w-4 h-4 text-gray-400" />;
    case 'skill_invoked':
      return <Zap className="w-4 h-4 text-amber-500" />;
    case 'capability_result':
      return <Sparkles className="w-4 h-4 text-violet-500" />;
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
}

function getNotificationBgColor(type: Notification['type']) {
  switch (type) {
    case 'info':
      return 'bg-blue-500/10';
    case 'success':
      return 'bg-emerald-500/10';
    case 'warning':
      return 'bg-amber-500/10';
    case 'error':
      return 'bg-red-500/10';
    case 'agent_connected':
      return 'bg-cyan-500/10';
    case 'agent_disconnected':
      return 'bg-gray-500/10';
    case 'skill_invoked':
      return 'bg-amber-500/10';
    case 'capability_result':
      return 'bg-violet-500/10';
    default:
      return 'bg-blue-500/10';
  }
}

function formatTimeAgo(timestamp: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const now = new Date().getTime();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (seconds < 10) return t('notifications.justNow');
  if (seconds < 60) return t('notifications.justNow');
  if (minutes < 60) return t('notifications.minutesAgo', { count: minutes });
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });
  return t('notifications.daysAgo', { count: days });
}

export function NotificationBell() {
  const { notifications, markAsRead, markAllAsRead, clearNotifications, setCurrentView } = useAppStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalCount = notifications.length;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      if (notification.actionUrl.startsWith('/agents/')) {
        const agentId = notification.actionUrl.split('/agents/')[1];
        useAppStore.getState().setSelectedAgentId(agentId);
        setCurrentView('agent-detail');
      } else {
        setCurrentView(notification.actionUrl.replace('/', '') as any);
      }
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 rounded-lg hover:bg-accent transition-all duration-200",
            unreadCount > 0 && "text-foreground"
          )}
        >
          <Bell className={cn(
            "w-[18px] h-[18px] transition-all duration-300",
            unreadCount > 0 && "text-foreground"
          )} />
          {unreadCount > 0 && (
            <>
              {/* Pulse ring animation for unread */}
              <span className="absolute inset-0 rounded-lg animate-ping bg-red-500/20 pointer-events-none" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                <Badge
                  className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold bg-red-500 text-white border-0 hover:bg-red-500 rounded-full flex items-center justify-center shadow-sm shadow-red-500/30"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              </motion.div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 rounded-xl border shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                {unreadCount} {t('notifications.unread')}
              </Badge>
            )}
            {totalCount > 0 && unreadCount === 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {totalCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 px-2 hover:bg-accent"
                onClick={markAllAsRead}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t('notifications.markAllRead')}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 px-2 hover:bg-accent text-muted-foreground hover:text-destructive"
                onClick={clearNotifications}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('notifications.clearAll')}
              </Button>
            )}
          </div>
        </div>

        {/* Notification List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Bell className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{t('notifications.noNotifications')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t('notifications.noNotificationsDesc')}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y divide-border/50">
              <AnimatePresence initial={false}>
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      className={cn(
                        'w-full flex items-start gap-3 p-3 text-left transition-all duration-200',
                        'hover:bg-accent/50',
                        !notification.read && 'bg-primary/[0.03] dark:bg-primary/[0.05]'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Icon */}
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        getNotificationBgColor(notification.type)
                      )}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!notification.read && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                          <span className={cn(
                            'text-sm font-medium truncate',
                            !notification.read && 'text-foreground',
                            notification.read && 'text-muted-foreground'
                          )}>
                            {notification.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                          {formatTimeAgo(notification.timestamp, t)}
                        </span>
                      </div>

                      {/* Mark as read button */}
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}

        {/* Footer - View All */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full h-8 text-xs justify-center hover:bg-accent"
                onClick={() => {
                  setCurrentView('notifications');
                  setOpen(false);
                }}
              >
                {t('notifications.viewAll')}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
