# PR Review Guidelines

As an automated PR reviewer, please analyze the code changes against the following guidelines. Provide constructive, clear, and action-oriented feedback.

## 1. Code Quality & Best Practices
- **Readability**: Variable and function names should be descriptive and self-documenting.
- **Complexity**: Keep functions small and focused on a single responsibility. Avoid deeply nested logical blocks.
- **Dead Code**: Ensure no console logs (unless for server logging), unused variables, commented-out code, or placeholder code are left.

## 2. Safety & Error Handling
- **Robustness**: Implement proper `try/catch` blocks for asynchronous calls and potential throwing sections.
- **Input Validation**: Never trust external inputs; sanitize and validate them.
- **Null & Undefined Checks**: Proactively check for optional/nullable properties before referencing them.

## 3. TypeScript Best Practices
- **Explicit Types**: Avoid using `any` unless absolutely necessary. Prefer strong interfaces, types, and generic parameters.
- **Modern Syntax**: Utilize modern language features like optional chaining (`?.`), nullish coalescing (`??`), and destructuring where appropriate.

## 4. Performance & Efficiency
- **Resource Management**: Properly close connections, file descriptors, and clean up subscriptions.
- **Unnecessary Computations**: Avoid costly operations inside loops or repetitive functions.
