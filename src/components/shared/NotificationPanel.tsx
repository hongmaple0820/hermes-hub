'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAppStore, Notification } from '@/lib/store';
import { useI18n } from '@/i18n';
import {
  Bell, Check, CheckCheck, Trash2, Info, CheckCircle, AlertTriangle,
  XCircle, Radio, LogOut, Zap, Sparkles, Filter, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

type FilterType = 'all' | 'info' | 'success' | 'warning' | 'error' | 'agent_events';

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

function getNotificationBorderColor(type: Notification['type']) {
  switch (type) {
    case 'info':
      return 'border-l-blue-500';
    case 'success':
      return 'border-l-emerald-500';
    case 'warning':
      return 'border-l-amber-500';
    case 'error':
      return 'border-l-red-500';
    case 'agent_connected':
      return 'border-l-cyan-500';
    case 'agent_disconnected':
      return 'border-l-gray-400';
    case 'skill_invoked':
      return 'border-l-amber-500';
    case 'capability_result':
      return 'border-l-violet-500';
    default:
      return 'border-l-blue-500';
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

function getDateGroup(timestamp: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const now = new Date();
  const then = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const notifDate = new Date(then.getFullYear(), then.getMonth(), then.getDate());

  if (notifDate.getTime() === today.getTime()) return t('notifications.today');
  if (notifDate.getTime() === yesterday.getTime()) return t('notifications.yesterday');
  return t('notifications.earlier');
}

export function NotificationPanel() {
  const {
    notifications, markAsRead, markAllAsRead, clearNotifications, removeNotification,
    setCurrentView,
  } = useAppStore();
  const { t } = useI18n();
  const [filter, setFilter] = useState<FilterType>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case 'info':
        return notifications.filter((n) => n.type === 'info');
      case 'success':
        return notifications.filter((n) => n.type === 'success');
      case 'warning':
        return notifications.filter((n) => n.type === 'warning');
      case 'error':
        return notifications.filter((n) => n.type === 'error');
      case 'agent_events':
        return notifications.filter((n) =>
          ['agent_connected', 'agent_disconnected', 'skill_invoked', 'capability_result'].includes(n.type)
        );
      default:
        return notifications;
    }
  }, [notifications, filter]);

  // Group by date
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    filteredNotifications.forEach((n) => {
      const group = getDateGroup(n.timestamp, t);
      if (!groups[group]) groups[group] = [];
      groups[group].push(n);
    });
    return groups;
  }, [filteredNotifications, t]);

  const handleNotificationClick = useCallback((notification: Notification) => {
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
    }
  }, [markAsRead, setCurrentView]);

  const filterTabs = [
    { value: 'all' as FilterType, label: t('notifications.filters.all') },
    { value: 'info' as FilterType, label: t('notifications.filters.info') },
    { value: 'success' as FilterType, label: t('notifications.filters.success') },
    { value: 'warning' as FilterType, label: t('notifications.filters.warning') },
    { value: 'error' as FilterType, label: t('notifications.filters.error') },
    { value: 'agent_events' as FilterType, label: t('notifications.filters.agentEvents') },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentView('dashboard')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="w-6 h-6" />
              {t('notifications.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0
                ? t('notifications.minutesAgo', { count: unreadCount }) + ' unread'
                : t('notifications.noNotifications')
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={markAllAsRead}
            >
              <CheckCheck className="w-4 h-4" />
              {t('notifications.markAllRead')}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={clearNotifications}
            >
              <Trash2 className="w-4 h-4" />
              {t('notifications.clearAll')}
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {t('notifications.filters.all')}
            </CardTitle>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList className="w-full justify-start h-9 p-0.5 bg-muted/50">
              {filterTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-muted-foreground">{t('notifications.noNotifications')}</p>
              <p className="text-sm text-muted-foreground/70 mt-1">{t('notifications.noNotificationsDesc')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([group, items]) => (
            <div key={group}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{group}</h3>
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground/60">{items.length}</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {items.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      layout
                    >
                      <Card
                        className={cn(
                          'rounded-xl transition-all duration-200 cursor-pointer group',
                          'border-l-4',
                          getNotificationBorderColor(notification.type),
                          'hover:shadow-md hover:-translate-y-0.5',
                          !notification.read && 'bg-primary/[0.02] dark:bg-primary/[0.04]',
                          notification.read && 'opacity-75'
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                              getNotificationBgColor(notification.type)
                            )}>
                              {getNotificationIcon(notification.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {!notification.read && (
                                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                )}
                                <span className="font-medium text-sm">{notification.title}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{notification.message}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs text-muted-foreground/60">
                                  {formatTimeAgo(notification.timestamp, t)}
                                </span>
                                {notification.actionUrl && (
                                  <span className="text-xs text-primary font-medium">
                                    View →
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  title={t('notifications.markAllRead')}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNotification(notification.id);
                                }}
                                title={t('notifications.delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
