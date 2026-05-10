# Build Policy

## Windows execution level

HexX Forge keeps the default Windows execution policy as a user-level app.

- `package.json` does not define a custom Windows manifest.
- The NSIS installer uses `"perMachine": false`, so installs are user-scoped by default.
- `requestedExecutionLevel` should not be changed for the current splash/update work.

## Rationale

Keeping normal execution avoids showing UAC prompts on every app start and keeps the update experience simple. Future work may need elevated privileges for Program Files game installs, system optimizer actions, registry changes, services, or protected folders. Those cases should be designed as task-level elevation or a helper flow instead of making the whole app require administrator rights.

## Revisit criteria

Review `requestedExecutionLevel` only when a concrete feature cannot work reliably with normal user permissions. Candidate options are:

- Keep normal execution and show recovery guidance for protected paths.
- Use `highestAvailable` only if broad app-level elevation is truly needed.
- Add a dedicated elevated helper for specific protected operations.
- Use `requireAdministrator` only for a release that explicitly depends on always-elevated execution.
