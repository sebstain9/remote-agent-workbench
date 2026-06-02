# Security

Remote Agent Workbench is a local developer tool. It is not designed as a hosted multi-user service.

## Boundaries

- Do not expose the server to the public internet.
- Keep `RAW_HOST=127.0.0.1` when you only need local access.
- Treat selected workspaces as trusted repositories.
- Keep Codex, Claude Code, and Git credentials managed outside this app.

## Secret Handling

This repository should not contain API keys, OAuth tokens, service-role keys, private keys, or local `.env` files.

Run:

```bash
npm run public-scan
```

before publishing changes.

## Reporting

Open a GitHub issue with a minimal reproduction and avoid posting secrets or private repository paths.
