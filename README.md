# Portfolio

Personal portfolio site for Robin "Bobby" Cloutier.

## Development

### Prerequisites

- Node.js 22.12.0+ (see `.nvmrc`)
- pnpm 9.0.0+

### Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev

# Build for production
pnpm run build

# Type check
pnpm run check

# Lint
pnpm run lint

# Format
pnpm run format

# Run tests
pnpm run test
```

## Project Structure

```
src/
  components/    - Reusable Astro components
  layouts/       - Page layouts
  pages/         - Page routes (auto-generated)
  styles/        - Global styles and design tokens
content/
  - Content collections (projects, writing, etc.)
public/
  - Static assets
tests/
  - Playwright tests
.github/workflows/
  - CI/CD workflows
```

## Design Tokens

Design tokens are defined in `src/styles/tokens.css` as CSS custom properties:
- `--ink`: Text color
- `--muted`: Secondary text
- `--bg`: Background
- `--surface`: Card/surface background
- `--accent`: Primary accent color
- `--line`: Borders

All tokens support light and dark modes via `prefers-color-scheme`.

## License

MIT
