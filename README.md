---
title: TRAVELER DEV Backend
emoji: 🛠️
colorFrom: gray
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# TRAVELER DEV Backend

Production backend for the TRAVELER DEV autonomous development workspace.
# Bolt Monorepo
Welcome to the Bolt monorepo! This repository contains the codebase for Bolt, an AI assistant developed by StackBlitz.
## Repository Structure
Currently, this monorepo contains a single package:
- [`bolt`](packages/bolt): The main package containing the UI interface for Bolt as well as the server components.
As the project grows, additional packages may be added to this workspace.
## Getting Started
### Prerequisites
- Node.js (v18.20.3)

- Node.js (v20.15.1)
- pnpm (v9.4.0)
### Installation
1. Clone the repository:
# Bolt
Bolt is an AI assistant developed by StackBlitz. This package contains the UI interface for Bolt as well as the server components, built using [Remix Run](https://remix.run/).
## Prerequisites
Before you begin, ensure you have the following installed:
## Setup
1. Clone the repository (if you haven't already):
```bash
git clone https://github.com/stackblitz/bolt.git
```
2. Install dependencies:
```bash
pnpm install
```

3. Create a `.env.local` file in the root directory and add your Anthropic API key:

```
ANTHROPIC_API_KEY=XXX
```

### Development
To start developing the Bolt UI:
1. Navigate to the bolt package:
```bash
cd packages/bolt
```
2. Start the development server:
Optionally, you an set the debug level or disable authentication:
Optionally, you an set the debug level:

VITE_LOG_LEVEL=debug
VITE_DISABLE_AUTH=1

If you want to run authentication against a local StackBlitz instance, add:

VITE_CLIENT_ORIGIN=https://local.stackblitz.com:3000
```

**Important**: Never commit your `.env.local` file to version control. It's already included in .gitignore.

## Available Scripts

- `pnpm run dev`: Starts the development server.
- `pnpm run build`: Builds the project.
- `pnpm run start`: Runs the built application locally using Wrangler Pages. This script uses `bindings.sh` to set up necessary bindings so you don't have to duplicate environment variables.
- `pnpm run preview`: Builds the project and then starts it locally, useful for testing the production build. Note, HTTP streaming currently doesn't work as expected with `wrangler pages dev`.
- `pnpm test:` Runs the test suite using Vitest.
- `pnpm run typecheck`: Runs TypeScript type checking.
- `pnpm run typegen`: Generates TypeScript types using Wrangler.
- `pnpm run deploy`: Builds the project and deploys it to Cloudflare Pages.

## Development

To start the development server:

```bash
pnpm run dev
```

This will start the Remix Vite development server.

## Testing

Run the test suite with:

```bash
pnpm test
```

## Deployment

To deploy the application to Cloudflare Pages:

```bash
pnpm run deploy
```

Make sure you have the necessary permissions and Wrangler is correctly configured for your Cloudflare account.
