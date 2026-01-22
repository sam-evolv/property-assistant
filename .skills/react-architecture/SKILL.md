# React Component Architecture Skill

## Description
This skill provides best practices for React/Next.js component architecture, refactoring patterns, code organization, and performance optimization. Use when building, reviewing, or refactoring React components.

## Trigger Patterns
Use this skill when:
- Creating new React components
- Refactoring existing components
- Reviewing component structure
- Optimizing performance
- Organizing project files
- User mentions "clean code", "refactor", or "best practices"

---

## Component Organization

### File Structure
```
src/
├── components/
│   ├── ui/                    # Reusable UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Toast.tsx
│   │   └── index.ts           # Barrel export
│   ├── features/              # Feature-specific components
│   │   ├── pipeline/
│   │   │   ├── PipelineKanban.tsx
│   │   │   ├── PipelineTable.tsx
│   │   │   └── UnitCard.tsx
│   │   └── snagging/
│   │       ├── SnagList.tsx
│   │       └── SnagDetail.tsx
│   └── layout/                # Layout components
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── PageContainer.tsx
├── hooks/                     # Custom hooks
│   ├── useToast.ts
│   ├── useDebounce.ts
│   └── useLocalStorage.ts
├── lib/                       # Utilities and configs
│   ├── design-tokens.ts
│   ├── utils.ts
│   └── api.ts
└── types/                     # TypeScript types
    └── index.ts
```

### Barrel Exports
Create `index.ts` files for clean imports:

```typescript
// components/ui/index.ts
export { Button } from './Button';
export { Card } from './Card';
export { Input } from './Input';
export { StatCardWithSparkline } from './StatCardWithSparkline';

// Usage
import { Button, Card, StatCardWithSparkline } from '@/components/ui';
```

---

## Component Patterns

### Functional Components with TypeScript
Always use functional components with proper typing:

```tsx
interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconName;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  sparklineData?: number[];
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  sparklineData,
  className,
}) => {
  // Component logic
  return (
    // JSX
  );
};
```

### Composition over Configuration
Prefer composable components over prop-heavy ones:

```tsx
// ❌ Avoid: Too many props
<Alert
  type="warning"
  title="Mortgage Expiring"
  description="Within 7 days"
  showIcon={true}
  dismissible={true}
  onDismiss={handleDismiss}
  actions={[{ label: 'View', onClick: handleView }]}
/>

// ✅ Prefer: Composition
<Alert type="warning">
  <Alert.Icon />
  <Alert.Content>
    <Alert.Title>Mortgage Expiring</Alert.Title>
    <Alert.Description>Within 7 days</Alert.Description>
  </Alert.Content>
  <Alert.Actions>
    <Button onClick={handleView}>View</Button>
  </Alert.Actions>
  <Alert.Dismiss onClick={handleDismiss} />
</Alert>
```

### Controlled vs Uncontrolled
Prefer controlled components for forms:

```tsx
// Controlled
const [value, setValue] = useState('');
<Input value={value} onChange={(e) => setValue(e.target.value)} />

// Uncontrolled (only when needed for performance)
const inputRef = useRef<HTMLInputElement>(null);
<Input ref={inputRef} defaultValue="" />
```

---

## Custom Hooks

### Extract Logic into Hooks
When component logic is reusable, extract it:

```tsx
// hooks/useToggle.ts
export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  
  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  
  return { value, toggle, setTrue, setFalse };
}

// Usage
const { value: isExpanded, toggle: toggleExpand } = useToggle(false);
```

### Hook Naming Convention
- Start with `use`
- Be descriptive: `useToast`, `useDebounce`, `useLocalStorage`
- Return objects for multiple values: `{ value, setValue, reset }`

### Common Hooks to Extract

```tsx
// useDebounce - for search inputs
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// useClickOutside - for dropdowns/modals
export function useClickOutside(ref: RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// useKeyboardShortcut - for command palette, etc.
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { ctrl, meta, shift } = modifiers;
      
      if (ctrl && !event.ctrlKey) return;
      if (meta && !event.metaKey) return;
      if (shift && !event.shiftKey) return;
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      
      event.preventDefault();
      callback();
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, modifiers]);
}
```

---

## State Management

### Local State First
Use local state unless you need to share across components:

```tsx
// Good: Local state for UI
const [isOpen, setIsOpen] = useState(false);
const [selectedId, setSelectedId] = useState<string | null>(null);
```

### Context for Shared State
Use Context for state shared across many components:

```tsx
// contexts/ToastContext.tsx
interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);
  
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
};
```

### When to Use External State Management
Consider Zustand, Jotai, or Redux only when:
- Complex state with many updaters
- State needs to persist across sessions
- Time-travel debugging needed
- Very large application with many state slices

---

## Performance Optimization

### Memoization

```tsx
// useMemo - for expensive calculations
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// useCallback - for functions passed as props
const handleClick = useCallback(() => {
  console.log('Clicked', id);
}, [id]);

// React.memo - for components that receive same props
const StatCard = React.memo<StatCardProps>(({ label, value, ...props }) => {
  return <div>...</div>;
});
```

### When NOT to Memoize
- Simple calculations
- Primitive values
- Functions only used locally
- Components that always re-render anyway

### Code Splitting

```tsx
// Lazy load heavy components
const CommandPalette = lazy(() => import('@/components/ui/CommandPalette'));

// Use with Suspense
<Suspense fallback={null}>
  <CommandPalette />
</Suspense>
```

### Virtualization for Long Lists
Use `react-virtual` or `react-window` for lists with 100+ items:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
});
```

---

## Refactoring Guidelines

### Signs a Component Needs Refactoring
1. **Line count > 200-300** — Split into smaller components
2. **Props count > 7-10** — Consider composition or context
3. **Multiple useState for related data** — Combine into object or useReducer
4. **Duplicated logic** — Extract into custom hook
5. **Deeply nested JSX** — Extract sub-components

### Refactoring Steps
1. **Identify the problem** — What makes this hard to maintain?
2. **Write tests first** — Ensure behavior is preserved
3. **Extract in small steps** — One change at a time
4. **Verify after each step** — Run tests, check visually

### Extract Sub-Components

```tsx
// Before: Monolithic component
const PipelinePage = () => {
  return (
    <div>
      <header>...</header>
      <div className="alerts">
        {alerts.map(alert => (
          <div className="alert">
            {/* 50 lines of alert JSX */}
          </div>
        ))}
      </div>
      <div className="stats">
        {/* 100 lines of stats JSX */}
      </div>
      <div className="kanban">
        {/* 200 lines of kanban JSX */}
      </div>
    </div>
  );
};

// After: Composed components
const PipelinePage = () => {
  return (
    <PageContainer>
      <PageHeader title="Pipeline" actions={headerActions} />
      <QuickActionsBar actions={pipelineActions} />
      <AlertsWidget alerts={alerts} />
      <StatsRow stats={pipelineStats} />
      <PipelineKanban units={units} onUnitMove={handleMove} />
    </PageContainer>
  );
};
```

### Extract Custom Hooks

```tsx
// Before: Logic in component
const SearchInput = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);
  
  useEffect(() => {
    if (debouncedQuery) {
      fetchResults(debouncedQuery);
    }
  }, [debouncedQuery]);
  
  // ...
};

// After: Logic in hook
const SearchInput = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const { data, isLoading } = useSearch(debouncedQuery);
  
  // ...
};
```

---

## Error Handling

### Error Boundaries

```tsx
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error caught:', error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<ErrorFallback />}>
  <ComponentThatMightError />
</ErrorBoundary>
```

### Async Error Handling

```tsx
const { data, error, isLoading } = useQuery(['units'], fetchUnits);

if (error) {
  return <ErrorState message="Failed to load units" retry={refetch} />;
}

if (isLoading) {
  return <LoadingSkeleton />;
}

return <UnitList units={data} />;
```

---

## Testing Considerations

### Testable Components
- Accept data as props (not fetched internally)
- Actions passed as callbacks
- No direct DOM manipulation
- Minimal side effects

```tsx
// ✅ Testable
const UnitCard: React.FC<{
  unit: Unit;
  onSelect: (id: string) => void;
}> = ({ unit, onSelect }) => {
  return (
    <div onClick={() => onSelect(unit.id)}>
      {unit.name}
    </div>
  );
};

// ❌ Hard to test
const UnitCard: React.FC<{ unitId: string }> = ({ unitId }) => {
  const [unit, setUnit] = useState(null);
  
  useEffect(() => {
    fetch(`/api/units/${unitId}`).then(r => r.json()).then(setUnit);
  }, [unitId]);
  
  const handleSelect = () => {
    window.location.href = `/units/${unitId}`;
  };
  
  return <div onClick={handleSelect}>{unit?.name}</div>;
};
```

---

## Checklist for Component Review

### Structure
- [ ] Single responsibility — does one thing well
- [ ] Reasonable size (< 200-300 lines)
- [ ] Props are well-typed with TypeScript
- [ ] Uses composition where appropriate

### Hooks
- [ ] Follows rules of hooks
- [ ] Custom hooks extracted for reusable logic
- [ ] Dependencies arrays are correct
- [ ] Cleanup functions where needed

### Performance
- [ ] Memoization used appropriately (not over-used)
- [ ] No unnecessary re-renders
- [ ] Large lists virtualized
- [ ] Heavy components code-split

### Accessibility
- [ ] Keyboard navigable
- [ ] ARIA attributes where needed
- [ ] Focus management for modals/dialogs
