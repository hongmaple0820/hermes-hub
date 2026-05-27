'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Wrench, Search, Plus, Globe, Code, Database, Mail,
  Image, Calculator, FileText, Zap, ArrowUpDown, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: typeof Wrench;
  installed: boolean;
  version: string;
  author: string;
  downloads: number;
}

const mockTools: Tool[] = [
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web for real-time information and news',
    category: 'web',
    icon: Globe,
    installed: true,
    version: '2.1.0',
    author: 'Hermes',
    downloads: 15420,
  },
  {
    id: 'code-exec',
    name: 'Code Interpreter',
    description: 'Execute Python, JavaScript, and other code in sandboxed environment',
    category: 'code',
    icon: Code,
    installed: true,
    version: '3.0.2',
    author: 'Hermes',
    downloads: 12380,
  },
  {
    id: 'database-query',
    name: 'Database Query',
    description: 'Query SQL and NoSQL databases with natural language',
    category: 'data',
    icon: Database,
    installed: false,
    version: '1.4.0',
    author: 'Community',
    downloads: 8750,
  },
  {
    id: 'email-sender',
    name: 'Email Sender',
    description: 'Send and manage emails through SMTP integration',
    category: 'communication',
    icon: Mail,
    installed: false,
    version: '1.2.1',
    author: 'Community',
    downloads: 6320,
  },
  {
    id: 'image-gen',
    name: 'Image Generator',
    description: 'Generate images from text descriptions using AI models',
    category: 'media',
    icon: Image,
    installed: true,
    version: '2.0.0',
    author: 'Hermes',
    downloads: 20150,
  },
  {
    id: 'calculator',
    name: 'Advanced Calculator',
    description: 'Mathematical computations, unit conversion, and formula solving',
    category: 'utility',
    icon: Calculator,
    installed: false,
    version: '1.1.0',
    author: 'Community',
    downloads: 4580,
  },
  {
    id: 'doc-parser',
    name: 'Document Parser',
    description: 'Parse and extract information from PDF, DOCX, and other document formats',
    category: 'data',
    icon: FileText,
    installed: true,
    version: '2.3.1',
    author: 'Hermes',
    downloads: 11890,
  },
  {
    id: 'api-connector',
    name: 'API Connector',
    description: 'Connect to any REST or GraphQL API with authentication support',
    category: 'web',
    icon: Zap,
    installed: false,
    version: '1.5.2',
    author: 'Community',
    downloads: 9210,
  },
];

const categories = [
  { id: 'all', label: 'All', icon: Filter },
  { id: 'web', label: 'Web', icon: Globe },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'communication', label: 'Comms', icon: Mail },
  { id: 'media', label: 'Media', icon: Image },
  { id: 'utility', label: 'Utility', icon: Calculator },
];

export function ToolRegistry() {
  const { t } = useI18n();
  const { skills } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'downloads'>('downloads');

  const filteredTools = mockTools
    .filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.downloads - a.downloads;
    });

  const installedCount = mockTools.filter((t) => t.installed).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" />
              {t('nav.toolRegistry')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse, install, and manage tools for your agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {installedCount}/{mockTools.length} installed
            </Badge>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Tool
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {cat.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setSortBy(sortBy === 'name' ? 'downloads' : 'name')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors border border-border"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === 'name' ? 'A-Z' : 'Popular'}
          </button>
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card className="hover:shadow-md transition-all duration-200 hover:border-primary/20 group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/15 group-hover:to-primary/10 transition-colors">
                        <Icon className="w-5 h-5 text-primary/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{tool.name}</p>
                          {tool.installed && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                              Installed
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-muted-foreground/70">v{tool.version}</span>
                          <span className="text-[10px] text-muted-foreground/70">by {tool.author}</span>
                          <span className="text-[10px] text-muted-foreground/70">{tool.downloads.toLocaleString()} downloads</span>
                        </div>
                      </div>
                      <Button
                        variant={tool.installed ? 'outline' : 'default'}
                        size="sm"
                        className="text-xs shrink-0"
                      >
                        {tool.installed ? 'Configure' : 'Install'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tools found matching your search</p>
            <p className="text-xs mt-1">Try a different search term or category</p>
          </div>
        )}
      </div>
    </div>
  );
}
