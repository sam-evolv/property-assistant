---
name: Frontend Complete
description: Comprehensive frontend skill for building, designing, and testing modern React/Next.js applications. Covers architecture, UI/UX design aesthetics, component patterns, state management, performance optimization, and testing with Vitest + React Testing Library.
version: 1.0.0
triggers:
  - react
  - nextjs
  - component
  - frontend
  - ui/ux
  - design
  - testing
  - vitest
  - refactor
  - performance
---

# Frontend Complete Skill

Build exceptional, tested, production-grade React and Next.js frontends with distinctive design.

---

## Part 1: Architecture & Building

### Core Principles

1. **Component Composition** - Break UI into small, reusable, single-purpose components
2. **State Proximity** - Keep state as close to where it's used as possible
3. **Performance by Default** - Optimize rendering, code splitting, and asset loading
4. **Developer Experience** - Clear naming, consistent patterns, helpful errors
5. **Testability** - Design components that are easy to test

### Framework Selection

| Use React + Vite | Use Next.js (Recommended) |
|------------------|---------------------------|
| Client-side only | SEO important |
| No SEO requirements | Server-side rendering |
| Simple static hosting | API routes needed |
| Faster initial setup | File-based routing |
| | Image optimization |

---

### Component Types & Architecture

#### File Structure

```
src/
├── components/
│   ├── ui/                    # Reusable UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── StatCard.tsx
│   │   └── index.ts           # Barrel export
│   ├── features/              # Feature-specific components
│   │   ├── pipeline/
│   │   │   ├── PipelineKanban.tsx
│   │   │   └── UnitCard.tsx
│   │   └── dashboard/
│   │       └── ActivityFeed.tsx
│   └── layout/                # Layout components
│       ├── Sidebar.tsx
│       └── PageContainer.tsx
├── hooks/                     # Custom hooks
│   ├── useToast.ts
│   ├── useDebounce.ts
│   └── useKeyboardShortcut.ts
├── lib/                       # Utilities and configs
│   ├── design-tokens.ts
│   └── utils.ts
├── contexts/                  # React contexts
│   └── ToastContext.tsx
└── types/                     # TypeScript types
    └── index.ts
```

#### Barrel Exports

```typescript
// components/ui/index.ts
export { Button } from './Button';
export { Card } from './Card';
export { StatCard, StatCardGrid } from './StatCard';
export type { StatCardProps } from './StatCard';

// Usage - clean imports
import { Button, Card, StatCard } from '@/components/ui';
```

#### Component Patterns

**1. Page Components** (Route entry points):

```typescript
// app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader title="Dashboard" />
      <QuickActionsBar actions={dashboardActions} />
      <StatCardGrid stats={stats} />
      <ActivityFeed activities={activities} />
    </PageContainer>
  )
}
```

**2. Feature Components** (Business logic):

```typescript
// components/features/UserList.tsx
interface UserListProps {
  users: User[];
  onSelect: (user: User) => void;
}

export function UserList({ users, onSelect }: UserListProps) {
  const { isLoading, error } = useUsers();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-2">
      {users.map(user => (
        <UserCard key={user.id} user={user} onClick={() => onSelect(user)} />
      ))}
    </div>
  );
}
```

**3. UI Components** (Reusable, no business logic):

```typescript
// components/ui/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({
  variant = 'primary',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants[variant])}
      {...props}
    >
      {children}
    </button>
  );
}
```

#### Composition over Configuration

```tsx
// ❌ Avoid: Too many props
<Alert
  type="warning"
  title="Mortgage Expiring"
  description="Within 7 days"
  showIcon={true}
  dismissible={true}
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
</Alert>
```

---

### State Management

#### Decision Tree

```
How many components need this state?
│
├─ One component → useState
├─ Parent + children → Props or useState + props
├─ Siblings → Lift to common parent
├─ Widely used (theme, auth) → Context API
└─ Complex app state → Zustand
```

#### Local State (useState)

```typescript
function Counter() {
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
    </div>
  );
}
```

#### Context API

```typescript
// contexts/ToastContext.tsx
interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be within ToastProvider');
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}
```

#### Zustand (Complex State)

```typescript
import { create } from 'zustand';

interface AppStore {
  user: User | null;
  theme: 'light' | 'dark';
  setUser: (user: User | null) => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  theme: 'light',
  setUser: (user) => set({ user }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
}));
```

---

### Custom Hooks

#### Extract Reusable Logic

```typescript
// hooks/useToggle.ts
export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse };
}

// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// hooks/useKeyboardShortcut.ts
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

### Data Fetching

#### React Query (Recommended)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query (GET)
function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} />;

  return <UserGrid users={data} />;
}

// Mutation (POST, PUT, DELETE)
function CreateUser() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <button onClick={() => mutation.mutate({ name: 'John' })}>
      {mutation.isPending ? 'Creating...' : 'Create User'}
    </button>
  );
}
```

#### Next.js Server Components

```typescript
// app/users/page.tsx - Server Component
export default async function UsersPage() {
  const users = await fetchUsers(); // Runs on server
  return <UserList users={users} />;
}

// Client Component for interactivity
'use client';

export function UserList({ users }: { users: User[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      {users.map(user => (
        <UserCard
          key={user.id}
          user={user}
          selected={selected === user.id}
          onClick={() => setSelected(user.id)}
        />
      ))}
    </div>
  );
}
```

---

### Form Handling

#### React Hook Form + Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginForm({ onSubmit }: { onSubmit: (data: LoginForm) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input {...register('email')} type="email" placeholder="Email" />
        {errors.email && <span className="text-red-500">{errors.email.message}</span>}
      </div>

      <div>
        <input {...register('password')} type="password" placeholder="Password" />
        {errors.password && <span className="text-red-500">{errors.password.message}</span>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

---

### Performance Optimization

#### Memoization

```typescript
import { memo, useMemo, useCallback } from 'react';

// 1. Memoize expensive calculations
function DataTable({ data }: { data: Item[] }) {
  const sortedData = useMemo(
    () => [...data].sort((a, b) => a.name.localeCompare(b.name)),
    [data]
  );

  return <Table data={sortedData} />;
}

// 2. Memoize callbacks passed to children
function Parent() {
  const handleClick = useCallback(() => {
    console.log('Clicked');
  }, []);

  return <ExpensiveChild onClick={handleClick} />;
}

// 3. Memoize components
const ExpensiveChild = memo(function ExpensiveChild({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Click</button>;
});
```

#### Code Splitting

```typescript
import dynamic from 'next/dynamic';

// Lazy load heavy components
const CommandPalette = dynamic(() => import('@/components/ui/CommandPalette'), {
  loading: () => null,
});

const ChartComponent = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

#### When NOT to Memoize

- Simple calculations
- Primitive values
- Functions only used locally
- Components that always re-render anyway

---

### Refactoring Guidelines

#### Signs a Component Needs Refactoring

1. **Line count > 200-300** — Split into smaller components
2. **Props count > 7-10** — Consider composition or context
3. **Multiple useState for related data** — Combine into object or useReducer
4. **Duplicated logic** — Extract into custom hook
5. **Deeply nested JSX** — Extract sub-components

#### Before & After

```tsx
// ❌ Before: Monolithic component
const PipelinePage = () => {
  return (
    <div>
      <header>...</header>
      <div className="alerts">{/* 50 lines */}</div>
      <div className="stats">{/* 100 lines */}</div>
      <div className="kanban">{/* 200 lines */}</div>
    </div>
  );
};

// ✅ After: Composed components
const PipelinePage = () => {
  return (
    <PageContainer>
      <PageHeader title="Pipeline" actions={headerActions} />
      <ProactiveAlerts alerts={alerts} />
      <StatCardGrid stats={pipelineStats} />
      <PipelineKanban units={units} onUnitMove={handleMove} />
    </PageContainer>
  );
};
```

---

## Part 2: Design & Aesthetics

### Design Philosophy

Before coding, understand the context and commit to a **BOLD aesthetic direction**:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick a clear direction: brutally minimal, maximalist, retro-futuristic, organic/natural, luxury/refined, playful, editorial, brutalist, art deco, soft/pastel, industrial, etc.
- **Differentiation**: What makes this UNFORGETTABLE?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work—the key is **intentionality**.

### Aesthetics Guidelines

#### Typography

- Choose fonts that are **beautiful, unique, and interesting**
- **AVOID**: Generic fonts like Arial, Inter, Roboto, system fonts
- **PREFER**: Distinctive choices that elevate the aesthetic
- Pair a distinctive display font with a refined body font

#### Color & Theme

- Commit to a **cohesive aesthetic**
- Use CSS variables for consistency
- Dominant colors with **sharp accents** outperform timid, evenly-distributed palettes

#### Motion & Animation

- Use animations for effects and micro-interactions
- Prioritize CSS-only solutions for HTML
- Focus on **high-impact moments**: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions
- Use scroll-triggering and hover states that surprise

#### Spatial Composition

- Unexpected layouts
- Asymmetry and overlap
- Grid-breaking elements
- Generous negative space OR controlled density

#### Backgrounds & Visual Details

Create atmosphere and depth:
- Gradient meshes
- Noise textures
- Geometric patterns
- Layered transparencies
- Dramatic shadows
- Custom cursors

### What to AVOID

**NEVER use generic AI aesthetics:**
- Overused font families (Inter, Roboto, Arial)
- Cliched color schemes (purple gradients on white)
- Predictable layouts
- Cookie-cutter designs lacking context-specific character

### Implementation Complexity

**Match complexity to vision:**
- Maximalist designs need elaborate code with extensive animations
- Minimalist designs need restraint, precision, and attention to spacing/typography
- Elegance comes from executing the vision well

---

## Part 3: Testing

### Tech Stack

| Tool | Purpose |
|------|---------|
| Vitest | Test runner |
| React Testing Library | Component testing |
| jsdom | Test environment |
| nock | HTTP mocking |

### Test Structure Template

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Component } from './Component';

// ✅ Mock external dependencies only
vi.mock('@/service/api');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/test',
}));

// ✅ DO NOT mock base components or sibling components

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Rendering tests (REQUIRED)
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<Component title="Test" />);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  // Props tests (REQUIRED)
  describe('Props', () => {
    it('should apply custom className', () => {
      render(<Component className="custom" />);
      expect(screen.getByRole('button')).toHaveClass('custom');
    });
  });

  // User Interactions
  describe('User Interactions', () => {
    it('should handle click events', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Component onClick={handleClick} />);
      await user.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  // Edge Cases (REQUIRED)
  describe('Edge Cases', () => {
    it('should handle null data', () => {
      render(<Component data={null} />);
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });
});
```

### Query Priority

Use queries in this order (most to least preferred):

```typescript
// 1. getByRole - Most recommended (accessibility)
screen.getByRole('button', { name: /submit/i });

// 2. getByLabelText - Form fields
screen.getByLabelText('Email address');

// 3. getByPlaceholderText - When no label
screen.getByPlaceholderText('Search...');

// 4. getByText - Non-interactive elements
screen.getByText(/loading/i);

// 5. getByTestId - Last resort only!
screen.getByTestId('custom-element');
```

### What to Mock vs Not Mock

#### DO NOT Mock
- Base components (`Loading`, `Button`, `Tooltip`)
- Sibling/child components in same directory
- Zustand stores (use `store.setState()` instead)

#### DO Mock
- API services (`@/service/*`)
- `next/navigation`
- Complex context providers with side effects

### Async Testing Patterns

```typescript
// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// findBy - auto-waits
const button = await screen.findByRole('button', { name: /submit/i });

// Testing loading → success → error states
it('should show loading then data', async () => {
  render(<DataComponent />);

  // Loading state
  expect(screen.getByRole('status')).toBeInTheDocument();

  // Wait for data
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

### Fake Timers

```typescript
describe('Debounced Search', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce search input', () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} debounceMs={300} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'query' } });

    expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledWith('query');
  });
});
```

### Testing Checklist

#### Always Required
- [ ] Component renders without crashing
- [ ] Required props work correctly
- [ ] Optional props have defaults
- [ ] Edge cases: null, undefined, empty

#### Conditional (When Present)
- [ ] useState: Initial state, transitions
- [ ] useEffect: Execution, cleanup
- [ ] Event handlers: All interactions
- [ ] API calls: Loading, success, error
- [ ] Forms: Validation, submission

### Common Testing Mistakes

```typescript
// ❌ Bad: Testing implementation details
expect(component.state.isOpen).toBe(true);

// ✅ Good: Testing behavior
expect(screen.getByRole('dialog')).toBeInTheDocument();

// ❌ Bad: Hardcoded strings
expect(screen.getByText('Submit Form')).toBeInTheDocument();

// ✅ Good: Pattern matching
expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();

// ❌ Bad: getBy for absence
expect(screen.getByText('Error')).not.toBeInTheDocument(); // Throws!

// ✅ Good: queryBy for absence
expect(screen.queryByText('Error')).not.toBeInTheDocument();
```

---

## Part 4: Error Handling

### Error Boundaries

```typescript
'use client';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### Next.js Error Handling

```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-lg font-semibold">Something went wrong!</h2>
      <p className="text-gray-500 mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4 btn-primary">
        Try again
      </button>
    </div>
  );
}
```

---

## Summary Checklist

### Architecture
- [ ] Small, focused, typed components
- [ ] Appropriate state management level
- [ ] Custom hooks for reusable logic
- [ ] Barrel exports for clean imports
- [ ] Consistent folder structure

### Design
- [ ] Clear aesthetic direction
- [ ] Distinctive typography
- [ ] Cohesive color palette
- [ ] Meaningful animations
- [ ] No generic "AI slop"

### Testing
- [ ] AAA pattern (Arrange-Act-Assert)
- [ ] Black-box testing (behavior, not implementation)
- [ ] Proper mocking (APIs, not components)
- [ ] Edge cases covered
- [ ] Async patterns correct

### Performance
- [ ] Memoization where beneficial
- [ ] Code splitting for heavy components
- [ ] Optimized images (Next.js Image)
- [ ] Virtualization for long lists

---

## Related Resources

- `react-architecture` skill - Additional component patterns
- `web/testing/testing.md` - Authoritative testing spec
- shadcn/ui - Component library
- TanStack Query - Data fetching
