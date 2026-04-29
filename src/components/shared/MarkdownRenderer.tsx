'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseInline(text: string): string {
  let result = text;
  // Inline code (must be before bold/italic to avoid conflicts)
  result = result.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">$1</a>');
  return result;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="relative group my-3 rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground border-b border-border">
        <span className="font-mono">{language || 'text'}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" /> {t('common.copied')}
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> {t('markdown.copy')}
            </>
          )}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function parseMarkdown(content: string): Array<{ type: 'code' | 'html'; content: string; language?: string }> {
  const parts: Array<{ type: 'code' | 'html'; content: string; language?: string }> = [];

  // Split by fenced code blocks
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add any text before this code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push({ type: 'html', content: renderMarkdownText(textBefore) });
      }
    }
    // Add the code block
    const language = match[1] || 'text';
    const code = match[2].replace(/\n$/, '');
    parts.push({ type: 'code', content: code, language });
    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last code block
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    if (remaining.trim()) {
      parts.push({ type: 'html', content: renderMarkdownText(remaining) });
    }
  }

  // If no parts were generated, treat the whole content as text
  if (parts.length === 0 && content.trim()) {
    parts.push({ type: 'html', content: renderMarkdownText(content) });
  }

  return parts;
}

function renderMarkdownText(text: string): string {
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listType = '';
  let inBlockquote = false;
  let inTable = false;
  let tableRows: string[][] = [];

  const closeList = () => {
    if (inList) {
      html += listType === 'ul' ? '</ul>' : '</ol>';
      inList = false;
      listType = '';
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      html += '</blockquote>';
      inBlockquote = false;
    }
  };

  const closeTable = () => {
    if (inTable && tableRows.length > 0) {
      html += '<div class="my-3 overflow-x-auto"><table class="w-full text-sm border-collapse border border-border rounded">';
      tableRows.forEach((row, i) => {
        const tag = i === 0 ? 'th' : 'td';
        html += '<tr>';
        row.forEach((cell) => {
          html += `<${tag} class="border border-border px-3 py-1.5 ${i === 0 ? 'bg-muted/50 font-medium text-left' : 'text-left'}">${parseInline(cell.trim())}</${tag}>`;
        });
        html += '</tr>';
      });
      html += '</table></div>';
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Empty line
    if (trimmedLine === '') {
      closeList();
      closeBlockquote();
      closeTable();
      continue;
    }

    // Table row
    if (trimmedLine.includes('|') && trimmedLine.startsWith('|')) {
      closeList();
      closeBlockquote();
      const cells = trimmedLine.split('|').filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      // Check if separator row
      if (cells.every((c) => /^[\s-:]+$/.test(c))) {
        continue; // skip separator row
      }
      inTable = true;
      tableRows.push(cells);
      continue;
    } else {
      closeTable();
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmedLine)) {
      closeList();
      closeBlockquote();
      html += '<hr class="my-4 border-border" />';
      continue;
    }

    // Headers
    const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      closeList();
      closeBlockquote();
      const level = headerMatch[1].length;
      const text = parseInline(escapeHtml(headerMatch[2]));
      const sizes: Record<number, string> = {
        1: 'text-2xl font-bold mt-6 mb-3',
        2: 'text-xl font-bold mt-5 mb-2',
        3: 'text-lg font-semibold mt-4 mb-2',
        4: 'text-base font-semibold mt-3 mb-1',
        5: 'text-sm font-semibold mt-3 mb-1',
        6: 'text-xs font-semibold mt-2 mb-1',
      };
      html += `<h${level} class="${sizes[level]}">${text}</h${level}>`;
      continue;
    }

    // Blockquote
    if (trimmedLine.startsWith('>')) {
      closeList();
      const quoteText = parseInline(escapeHtml(trimmedLine.replace(/^>\s*/, '')));
      if (!inBlockquote) {
        html += '<blockquote class="my-3 pl-4 border-l-4 border-primary/30 text-muted-foreground italic">';
        inBlockquote = true;
      }
      html += `<p class="mb-1">${quoteText}</p>`;
      continue;
    } else {
      closeBlockquote();
    }

    // Unordered list
    const ulMatch = trimmedLine.match(/^[-*+]\s+(.+)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        html += '<ul class="my-2 ml-6 list-disc space-y-1">';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${parseInline(escapeHtml(ulMatch[1]))}</li>`;
      continue;
    }

    // Ordered list
    const olMatch = trimmedLine.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        html += '<ol class="my-2 ml-6 list-decimal space-y-1">';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${parseInline(escapeHtml(olMatch[1]))}</li>`;
      continue;
    }

    // Regular paragraph
    closeList();
    html += `<p class="my-1 leading-relaxed">${parseInline(escapeHtml(trimmedLine))}</p>`;
  }

  closeList();
  closeBlockquote();
  closeTable();

  return html;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const parts = parseMarkdown(content);

  return (
    <div className={cn('markdown-renderer text-sm', className)}>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return <CodeBlock key={index} code={part.content} language={part.language || 'text'} />;
        }
        return (
          <div key={index} dangerouslySetInnerHTML={{ __html: part.content }} />
        );
      })}
    </div>
  );
}
