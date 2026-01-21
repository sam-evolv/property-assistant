'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Home,
  Users,
  FileText,
  Settings,
  BarChart3,
  Building2,
  Mail,
  HelpCircle,
  Command,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  group?: string;
  action?: () => void;
  href?: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  commands?: CommandItem[];
  placeholder?: string;
  onSearch?: (query: string) => Promise<CommandItem[]> | CommandItem[];
  className?: string;
}

// Default navigation commands
const defaultCommands: CommandItem[] = [
  {
    id: 'nav-overview',
    label: 'Go to Overview',
    description: 'View your dashboard',
    icon: Home,
    group: 'Navigation',
    href: '/developer',
    shortcut: 'G O',
    keywords: ['home', 'dashboard', 'main'],
  },
  {
    id: 'nav-homeowners',
    label: 'Go to Homeowners',
    description: 'Manage homeowners list',
    icon: Users,
    group: 'Navigation',
    href: '/developer/homeowners',
    shortcut: 'G H',
    keywords: ['residents', 'purchasers', 'users'],
  },
  {
    id: 'nav-archive',
    label: 'Go to Smart Archive',
    description: 'View and manage documents',
    icon: FileText,
    group: 'Navigation',
    href: '/developer/archive',
    shortcut: 'G A',
    keywords: ['documents', 'files', 'uploads'],
  },
  {
    id: 'nav-analytics',
    label: 'Go to Analytics',
    description: 'View engagement analytics',
    icon: BarChart3,
    group: 'Navigation',
    href: '/developer/analytics',
    shortcut: 'G N',
    keywords: ['stats', 'metrics', 'reports'],
  },
  {
    id: 'nav-scheme',
    label: 'Go to Scheme Setup',
    description: 'Configure development settings',
    icon: Building2,
    group: 'Navigation',
    href: '/developer/scheme-setup',
    shortcut: 'G S',
    keywords: ['development', 'project', 'configure'],
  },
  {
    id: 'action-email',
    label: 'Send Email to Homeowners',
    description: 'Compose a new email',
    icon: Mail,
    group: 'Actions',
    keywords: ['message', 'contact', 'communicate'],
  },
  {
    id: 'action-settings',
    label: 'Open Settings',
    description: 'Manage your preferences',
    icon: Settings,
    group: 'Actions',
    href: '/developer/scheme-setup',
    keywords: ['preferences', 'config', 'options'],
  },
  {
    id: 'help',
    label: 'Help & Support',
    description: 'Get help with OpenHouse',
    icon: HelpCircle,
    group: 'Help',
    keywords: ['support', 'documentation', 'guide'],
  },
];

function groupCommands(commands: CommandItem[]) {
  const groups = new Map<string, CommandItem[]>();

  commands.forEach((command) => {
    const group = command.group || 'Other';
    const existing = groups.get(group) || [];
    existing.push(command);
    groups.set(group, existing);
  });

  return groups;
}

export function CommandPalette({
  commands = defaultCommands,
  placeholder = 'Search commands...',
  onSearch,
  className,
}: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>(commands);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Filter commands based on query
  const filterCommands = useCallback(
    async (searchQuery: string) => {
      if (onSearch) {
        setIsLoading(true);
        try {
          const results = await onSearch(searchQuery);
          setFilteredCommands(results);
        } finally {
          setIsLoading(false);
        }
      } else {
        const normalizedQuery = searchQuery.toLowerCase().trim();
        if (!normalizedQuery) {
          setFilteredCommands(commands);
          return;
        }

        const filtered = commands.filter((command) => {
          const searchableText = [
            command.label,
            command.description,
            ...(command.keywords || []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return searchableText.includes(normalizedQuery);
        });

        setFilteredCommands(filtered);
      }
    },
    [commands, onSearch]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      if (!isOpen) return;

      // Close with Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        return;
      }

      // Navigate with arrow keys
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      }

      // Execute with Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          executeCommand(selected);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter commands when query changes
  useEffect(() => {
    filterCommands(query);
    setSelectedIndex(0);
  }, [query, filterCommands]);

  const executeCommand = (command: CommandItem) => {
    setIsOpen(false);
    setQuery('');

    if (command.action) {
      command.action();
    } else if (command.href) {
      router.push(command.href);
    }
  };

  const groupedCommands = groupCommands(filteredCommands);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => {
          setIsOpen(false);
          setQuery('');
        }}
      />

      {/* Command Palette Modal */}
      <div
        className={cn(
          'fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50',
          'bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden',
          className
        )}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded">
            <Command className="w-3 h-3" />K
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-500">No commands found</p>
              <p className="text-xs text-gray-400 mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="py-2">
              {Array.from(groupedCommands.entries()).map(([group, items]) => (
                <div key={group}>
                  <div className="px-4 py-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {group}
                    </p>
                  </div>
                  {items.map((command, index) => {
                    const globalIndex = filteredCommands.indexOf(command);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = command.icon;

                    return (
                      <button
                        key={command.id}
                        onClick={() => executeCommand(command)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                        )}
                      >
                        {Icon && (
                          <Icon
                            className={cn(
                              'w-5 h-5',
                              isSelected ? 'text-gray-900' : 'text-gray-400'
                            )}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              isSelected ? 'text-gray-900' : 'text-gray-700'
                            )}
                          >
                            {command.label}
                          </p>
                          {command.description && (
                            <p className="text-xs text-gray-500 truncate">
                              {command.description}
                            </p>
                          )}
                        </div>
                        {command.shortcut && (
                          <kbd className="hidden sm:block px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded">
                            {command.shortcut}
                          </kbd>
                        )}
                        {isSelected && (
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">
                ↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">
                ↵
              </kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">
                esc
              </kbd>
              <span>Close</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook to use command palette
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
}

export default CommandPalette;
