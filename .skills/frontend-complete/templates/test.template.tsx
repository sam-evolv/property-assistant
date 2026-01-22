/**
 * Test Template for React Components
 *
 * Usage: Copy and customize for new component tests
 *
 * File naming: ComponentName.spec.tsx (same directory as component)
 *
 * Checklist:
 * - [ ] Rendering tests (required)
 * - [ ] Props tests (required)
 * - [ ] User interaction tests
 * - [ ] Edge case tests (required)
 * - [ ] Async tests (if applicable)
 * - [ ] Accessibility tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from './ComponentName';

// ============================================================================
// Mocks
// ============================================================================

// ✅ Mock external dependencies only
vi.mock('@/service/api');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

// ❌ DO NOT mock base components or sibling components
// Import them directly and let them render

// ============================================================================
// Test Utilities
// ============================================================================

const defaultProps = {
  value: 'Test Value',
  onClick: vi.fn(),
};

const renderComponent = (props = {}) => {
  return render(<ComponentName {...defaultProps} {...props} />);
};

// ============================================================================
// Tests
// ============================================================================

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Rendering Tests (REQUIRED)
  // --------------------------------------------------------------------------
  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderComponent();
      expect(screen.getByText('Test Value')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      renderComponent({ className: 'custom-class' });
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('should render different variants', () => {
      const { rerender } = render(<ComponentName {...defaultProps} variant="primary" />);
      expect(screen.getByRole('button')).toHaveClass('bg-gold-500');

      rerender(<ComponentName {...defaultProps} variant="secondary" />);
      expect(screen.getByRole('button')).toHaveClass('bg-gray-100');
    });
  });

  // --------------------------------------------------------------------------
  // Props Tests (REQUIRED)
  // --------------------------------------------------------------------------
  describe('Props', () => {
    it('should use default values for optional props', () => {
      render(<ComponentName value="Test" />);
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    it('should apply disabled state', () => {
      renderComponent({ disabled: true });
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should show loading state', () => {
      renderComponent({ isLoading: true });
      expect(screen.getByRole('button')).toHaveClass('animate-pulse');
    });
  });

  // --------------------------------------------------------------------------
  // User Interactions
  // --------------------------------------------------------------------------
  describe('User Interactions', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      renderComponent({ onClick: handleClick });
      await user.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      renderComponent({ onClick: handleClick, disabled: true });
      await user.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      renderComponent({ onClick: handleClick });

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be focusable when not disabled', () => {
      renderComponent();
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('tabIndex', '0');
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases (REQUIRED)
  // --------------------------------------------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty value', () => {
      renderComponent({ value: '' });
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle very long value', () => {
      const longValue = 'A'.repeat(1000);
      renderComponent({ value: longValue });
      expect(screen.getByText(longValue)).toBeInTheDocument();
    });

    it('should handle special characters', () => {
      renderComponent({ value: '<script>alert("xss")</script>' });
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
    });

    it('should handle rapid clicks', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      renderComponent({ onClick: handleClick });

      const button = screen.getByRole('button');
      await user.tripleClick(button);

      expect(handleClick).toHaveBeenCalledTimes(3);
    });
  });

  // --------------------------------------------------------------------------
  // Async Tests (when component has async behavior)
  // --------------------------------------------------------------------------
  describe('Async Behavior', () => {
    it('should show loading then content', async () => {
      renderComponent({ isLoading: true });

      expect(screen.getByRole('button')).toHaveClass('animate-pulse');

      // Simulate loading complete
      // rerender with isLoading: false
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility Tests
  // --------------------------------------------------------------------------
  describe('Accessibility', () => {
    it('should have correct aria attributes', () => {
      renderComponent({ disabled: true });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();
    });
  });
});

// ============================================================================
// Data-Driven Tests (for components with many variants)
// ============================================================================

describe('ComponentName Variants', () => {
  test.each([
    ['default', 'bg-white'],
    ['primary', 'bg-gold-500'],
    ['secondary', 'bg-gray-100'],
  ])('variant "%s" should have class "%s"', (variant, expectedClass) => {
    render(<ComponentName value="Test" variant={variant as any} />);
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  test.each([
    { disabled: true, loading: false, clickable: false },
    { disabled: false, loading: true, clickable: false },
    { disabled: false, loading: false, clickable: true },
  ])(
    'should be clickable=$clickable when disabled=$disabled and loading=$loading',
    async ({ disabled, loading, clickable }) => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <ComponentName
          value="Test"
          disabled={disabled}
          isLoading={loading}
          onClick={handleClick}
        />
      );

      await user.click(screen.getByRole('button'));

      if (clickable) {
        expect(handleClick).toHaveBeenCalled();
      } else {
        expect(handleClick).not.toHaveBeenCalled();
      }
    }
  );
});
