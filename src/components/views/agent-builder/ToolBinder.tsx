'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/i18n';
import { Search, Plus, X, Wrench, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock tools data
export interface ToolItem {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  handlerType: string;
}

export const MOCK_TOOLS: ToolItem[] = [
  {
    id: 'tool-web-search',
    name: 'web_search',
    displayName: 'Web Search',
    description: 'Search the web for information using various search engines',
    category: 'communication',
    icon: '🔍',
    handlerType: 'builtin',
  },
  {
    id: 'tool-calculator',
    name: 'calculator',
    displayName: 'Calculator',
    description: 'Perform mathematical calculations and computations',
    category: 'utility',
    icon: '🧮',
    handlerType: 'builtin',
  },
  {
    id: 'tool-file-read',
    name: 'file_read',
    displayName: 'File Read',
    description: 'Read file contents from the local filesystem',
    category: 'development',
    icon: '📁',
    handlerType: 'builtin',
  },
  {
    id: 'tool-file-write',
    name: 'file_write',
    displayName: 'File Write',
    description: 'Write content to files on the local filesystem',
    category: 'development',
    icon: '✏️',
    handlerType: 'builtin',
  },
  {
    id: 'tool-http-request',
    name: 'http_request',
    displayName: 'HTTP Request',
    description: 'Make HTTP requests to external APIs and services',
    category: 'communication',
    icon: '🌐',
    handlerType: 'http',
  },
  {
    id: 'tool-code-execute',
    name: 'code_execute',
    displayName: 'Code Execute',
    description: 'Execute code in a sandboxed environment',
    category: 'development',
    icon: '💻',
    handlerType: 'builtin',
  },
  {
    id: 'tool-database-query',
    name: 'database_query',
    displayName: 'Database Query',
    description: 'Query databases using SQL or ORM methods',
    category: 'data',
    icon: '🗄️',
    handlerType: 'builtin',
  },
  {
    id: 'tool-image-gen',
    name: 'image_generate',
    displayName: 'Image Generate',
    description: 'Generate images from text descriptions',
    category: 'media',
    icon: '🎨',
    handlerType: 'http',
  },
  {
    id: 'tool-schedule',
    name: 'schedule_task',
    displayName: 'Schedule Task',
    description: 'Schedule tasks to run at specified times',
    category: 'productivity',
    icon: '⏰',
    handlerType: 'builtin',
  },
  {
    id: 'tool-translate',
    name: 'translate',
    displayName: 'Translate',
    description: 'Translate text between different languages',
    category: 'communication',
    icon: '🌍',
    handlerType: 'http',
  },
];

export interface BoundTool {
  toolId: string;
  isEnabled: boolean;
  priority: number;
}

interface ToolBinderProps {
  availableTools?: ToolItem[];
  boundTools: BoundTool[];
  onChange: (boundTools: BoundTool[]) => void;
}

const categoryColors: Record<string, string> = {
  communication: 'bg-sky-500/10 text-sky-600 border-sky-200',
  productivity: 'bg-amber-500/10 text-amber-600 border-amber-200',
  development: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  data: 'bg-purple-500/10 text-purple-600 border-purple-200',
  media: 'bg-rose-500/10 text-rose-600 border-rose-200',
  utility: 'bg-gray-500/10 text-gray-600 border-gray-200',
  general: 'bg-gray-500/10 text-gray-600 border-gray-200',
};

export function ToolBinder({ availableTools = MOCK_TOOLS, boundTools, onChange }: ToolBinderProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

  const boundToolIds = useMemo(
    () => new Set(boundTools.map((bt) => bt.toolId)),
    [boundTools]
  );

  const availableUnbound = useMemo(
    () =>
      availableTools
        .filter((tool) => !boundToolIds.has(tool.id))
        .filter(
          (tool) =>
            !searchQuery ||
            tool.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tool.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    [availableTools, boundToolIds, searchQuery]
  );

  const boundToolsList = useMemo(
    () =>
      boundTools
        .map((bt) => {
          const tool = availableTools.find((t) => t.id === bt.toolId);
          return tool ? { ...bt, tool } : null;
        })
        .filter(Boolean) as (BoundTool & { tool: ToolItem })[],
    [boundTools, availableTools]
  );

  const handleAdd = (toolId: string) => {
    onChange([
      ...boundTools,
      { toolId, isEnabled: true, priority: boundTools.length },
    ]);
  };

  const handleRemove = (toolId: string) => {
    onChange(boundTools.filter((bt) => bt.toolId !== toolId));
  };

  const handleToggle = (toolId: string) => {
    onChange(
      boundTools.map((bt) =>
        bt.toolId === toolId ? { ...bt, isEnabled: !bt.isEnabled } : bt
      )
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Available Tools */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            {t('agentBuilder.tools.available')}
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {availableUnbound.length}
            </Badge>
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={t('agentBuilder.tools.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs rounded-lg"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[320px] pr-1">
            {availableUnbound.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? t('common.noResults') : t('agentBuilder.tools.noToolsAvailable')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {availableUnbound.map((tool) => (
                    <motion.div
                      key={tool.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/50 transition-colors group"
                    >
                      <span className="text-base shrink-0">{tool.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{tool.displayName}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] px-1 py-0 border',
                              categoryColors[tool.category] || categoryColors.general
                            )}
                          >
                            {tool.category}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {tool.description}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleAdd(tool.id)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bound Tools */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            {t('agentBuilder.tools.bound')}
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {boundToolsList.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[320px] pr-1">
            {boundToolsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Wrench className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {t('agentBuilder.tools.noToolsBound')}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Click + on available tools to bind them
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {boundToolsList.map((bt, index) => (
                    <motion.div
                      key={bt.toolId}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-lg border transition-colors',
                        bt.isEnabled
                          ? 'border-primary/20 bg-primary/5'
                          : 'border-border bg-muted/30 opacity-60'
                      )}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 cursor-grab" />
                      <span className="text-base shrink-0">{bt.tool.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{bt.tool.displayName}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] px-1 py-0 border',
                              categoryColors[bt.tool.category] || categoryColors.general
                            )}
                          >
                            {bt.tool.category}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {bt.tool.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-muted-foreground">
                          #{index + 1}
                        </span>
                        <Switch
                          checked={bt.isEnabled}
                          onCheckedChange={() => handleToggle(bt.toolId)}
                          className="scale-75"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(bt.toolId)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
