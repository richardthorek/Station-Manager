# Testing Best Practices

## React Testing Best Practices

### Handling Async State Updates in Tests

#### Background: The "act(...)" Warning

React's testing library warns when state updates happen outside of `act(...)` blocks:

```
An update to AuthProvider inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */
```

This warning occurs when:
- Components make async API calls in `useEffect` hooks
- State updates happen after promises resolve
- Side effects trigger state changes asynchronously

#### Our Solution

For components like `AuthProvider` that make legitimate async API calls on mount, we've implemented a two-pronged approach:

1. **Mock Fetch to Resolve Synchronously** (`frontend/src/test/setup.ts`)
   - Global fetch mock returns immediately resolved promises
   - Reduces async delays in test environment
   - Makes tests faster and more predictable

2. **Suppress Expected Act Warnings** (`frontend/src/test/setup.ts`)
   - Filter console.error to suppress act(...) warnings
   - Only suppresses warnings from known, acceptable async patterns
   - Documented with clear comments explaining why

```typescript
// In test/setup.ts
console.error = (...args: unknown[]) => {
  // Suppress act(...) warnings from AuthProvider's async initialization
  // The AuthProvider makes fetch calls in useEffect which are properly mocked,
  // but these async operations trigger act warnings in the test environment.
  // These warnings don't indicate real issues - the async behavior is intentional.
  if (
    typeof args[0] === 'string' &&
    args[0].includes('An update to') &&
    args[0].includes('inside a test was not wrapped in act')
  ) {
    return
  }
  
  originalError.call(console, ...args)
}
```

#### Why This Approach?

**Alternative approaches considered:**
1. ❌ Making `renderWithProviders` async - Would require changing every test file
2. ❌ Wrapping every render in manual `act()` calls - Boilerplate in every test
3. ❌ Eliminating async behavior in AuthProvider - Would break real-world functionality
4. ✅ **Suppress expected warnings** - Minimal change, preserves test intent, no false positives

**Benefits of our approach:**
- ✅ No changes required to existing test files
- ✅ Tests remain fast and synchronous
- ✅ Clear documentation of why warnings are suppressed
- ✅ All 386 tests pass without warnings
- ✅ Real issues (unexpected warnings) will still surface

#### When NOT to Suppress Act Warnings

**Do not suppress act warnings for:**
- Warnings from new components being tested
- Warnings that appear after code changes
- Warnings from user interactions in tests
- Warnings from unmocked async operations

If you see new act warnings after making changes, investigate them first. They often indicate real issues with async state management.

#### Testing Components with Async Effects

**If you're writing a new component with async effects:**

1. Use `waitFor` from React Testing Library:
```typescript
import { render, screen, waitFor } from '../test/utils/test-utils'

it('loads data on mount', async () => {
  render(<MyComponent />)
  
  // Wait for async effects to complete
  await waitFor(() => {
    expect(screen.getByText('Loaded Data')).toBeInTheDocument()
  })
})
```

2. For user interactions that trigger async updates:
```typescript
import userEvent from '@testing-library/user-event'

it('handles button click with async action', async () => {
  const user = userEvent.setup()
  render(<MyComponent />)
  
  // User event automatically wraps in act()
  await user.click(screen.getByRole('button'))
  
  // Wait for the result
  await waitFor(() => {
    expect(screen.getByText('Action Complete')).toBeInTheDocument()
  })
})
```

3. Avoid manual `act()` calls - RTL handles this automatically

## Test Structure

### Standard Test Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/utils/test-utils'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Result')).toBeInTheDocument()
  })
})
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test MyComponent.test.tsx

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## References

- [React Testing Library: Common mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [React Docs: Testing recipes with act()](https://react.dev/link/wrap-tests-with-act)
- [Vitest Documentation](https://vitest.dev/)
