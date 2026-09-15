# Contributing

**`github.com/Quidli/connect-mcp` is a read-only mirror.** It is regenerated from
Quidli's internal monorepo on every npm release, and the sync deletes anything it
does not know about. **Commits, branches and merged pull requests made directly in
that repository will be destroyed by the next release.**

That is not hypothetical — the Troubleshooting and Grok sections of the README were
written in the mirror and had to be recovered before the first sync could run.

## Where changes go

| You want to | Do this |
|---|---|
| Report a bug or ask a question | Open an issue on the mirror — issues are not affected by the sync |
| Suggest a code or docs change | Open an issue describing it, or contact the maintainers. Do not open a PR against the mirror |
| Are a Quidli maintainer | Edit `packages/connect-mcp` in `sns-backend`. It ships to npm and propagates here automatically |

## Two files that live only in the mirror

`mcp.json` and everything under `.github/` are excluded from the sync, so they are
edited in the mirror directly and will survive.
