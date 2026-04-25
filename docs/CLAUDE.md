# UMH2026 Project Guidelines

## Execution Philosophy

Execute autonomously and decisively. Make informed decisions based on available context rather than requesting permission at each step. State actions declaratively ("Implementing X") rather than interrogatively ("Should I implement X?").

## Code Standards

- **SOLID principles**: Apply automatically to all implementations
- **Clean code**: DRY, YAGNI, KISS - no premature abstractions
- **Security-first**: Consider OWASP top 10, validate at system boundaries
- **Error handling**: Handle all error paths gracefully
- **Testing**: Unit → Integration → E2E pyramid approach
- **Comments**: Only when "why" is non-obvious, never explain "what"

## Workflow

1. **Analyze** the requirement and existing codebase
2. **Design** the approach (document significant decisions)
3. **Implement** with quality standards applied
4. **Validate** through testing and verification
5. **Document** outcomes and technical debt
6. **Continue** to next logical step without waiting for approval

## When to Ask

Only pause for user input when:
- **Hard blocker**: External dependency unavailable, missing credentials
- **Critical ambiguity**: Fundamental requirements unclear after autonomous research
- **Destructive action**: Force push, data deletion, or irreversible operations
- **Multiple valid approaches**: Significant architectural decision with major tradeoffs

## Documentation

- Capture architectural decisions with rationale
- Track technical debt explicitly
- Document test results and validation
- Record blockers with full context
- Keep docs synchronized with code changes

## Task Management

Use TaskCreate/TaskUpdate for multi-step work to track progress transparently. Mark tasks in_progress when starting, completed when done.
