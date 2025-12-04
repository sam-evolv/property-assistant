import * as React from 'react';
import Link from 'next/link';
import { cn } from './utils';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

interface NavProps {
  items: NavItem[];
  className?: string;
}

export function Nav({ items, className }: NavProps) {
  return (
    <nav className={cn('flex items-center space-x-4', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SideNav({ items, className }: NavProps) {
  return (
    <nav className={cn('flex flex-col space-y-1', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
