# Repository Guidelines

## Project Structure & Module Organization
This repository is currently a planning workspace, not an application codebase. The primary source artifact is `Ubuntu_Codex_Workbench_PRD.docx`, which defines the Ubuntu Codex Workbench MVP. Keep top-level clutter low: product docs belong in the repository root only when they are canonical; move supporting notes into a future `docs/` directory.

If implementation starts, keep the structure explicit:
- `docs/` for PRDs, architecture notes, and screenshots
- `frontend/` for the desktop UI or renderer code
- `backend/` for task orchestration, CLI integration, and local services
- `assets/` for icons, notification images, and static resources

## Build, Test, and Development Commands
No build system is committed yet. Until code is added, contributors should limit changes to documentation updates and file organization.

When scaffolding begins, prefer reproducible root-level commands such as:
- `npm install` to install workspace dependencies
- `npm run dev` to launch the desktop app in development
- `npm run build` to produce a distributable build
- `npm test` to run automated tests

Document any new command in `README.md` when it is introduced.

## Coding Style & Naming Conventions
Use Markdown for documentation and keep sections short, task-focused, and easy to diff. Name new documents descriptively, for example `docs/architecture-overview.md` or `docs/task-runner-notes.md`.

For future code:
- use 2-space indentation in frontend TypeScript/JavaScript
- use `camelCase` for variables and functions
- use `PascalCase` for UI components and classes
- use `kebab-case` for Markdown files and asset names

Add Prettier and ESLint before large code contributions.

## Testing Guidelines
There is no test suite yet. Once code exists, place frontend tests beside source files or under `tests/`, and name them `*.test.ts` or `*.spec.ts`. Prioritize coverage for project switching, Codex task execution, log streaming, and desktop notifications.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so use clear imperative commit messages such as `docs: add contributor guide` or `feat: scaffold task runner`. Keep pull requests focused, include a short description, reference the relevant requirement in the PRD, and attach screenshots for UI changes.

## Security & Configuration Tips
Do not commit local paths, secrets, tokens, or machine-specific Codex settings. If environment variables are introduced later, add a checked-in `.env.example` and document each variable’s purpose.
