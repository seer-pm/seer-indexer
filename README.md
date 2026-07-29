## Seer PM Indexer (HyperIndex V3)

*Please refer to the [documentation website](https://docs.envio.dev) for a thorough guide on all [Envio](https://envio.dev) indexer features*

### Pre-requisites

- [Node.js (use v22 or newer)](https://nodejs.org/en/download/current)
- [pnpm (use v8 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)
- `ENVIO_API_TOKEN` — free token at [envio.dev/app/api-tokens](https://envio.dev/app/api-tokens) (required for HyperSync)

### Generate types from `config.yaml` / `schema.graphql`

```bash
pnpm codegen
```

### Run

```bash
ENVIO_TUI=false pnpm dev
```

Use `pnpm dev -r` to reset the DB on startup. Visit http://localhost:8080 for the GraphQL Playground (local password `testing`).
