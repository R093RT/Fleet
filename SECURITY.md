# Security

## Threat model

Fleet is a **local-only developer tool**. It runs on `localhost:4000` and is designed to be used exclusively by the person who installed it on their own machine. It is not a multi-user application and has no authentication layer.

Key assumptions:

- Only **you** access `http://localhost:4000`
- You trust the agent repos you configure
- Your machine is not a shared or public server

---

## What is protected

### API key

Your `ANTHROPIC_API_KEY` lives in `.env` at the Fleet project root.

- `.env` is listed in `.gitignore` and **will never be committed**
- `.env.example` (which is committed) contains no real key
- The key is only passed to the `claude` CLI child process via `process.env` — it is never sent to a browser or logged

To verify your `.env` is not tracked:
```bash
git check-ignore -v .env    # should print: .gitignore:3:.env  .env
git ls-files .env           # should print nothing
```

### Input validation

Every API route validates its inputs with [Zod](https://zod.dev/) before processing:

- `agentId` — restricted to `[a-zA-Z0-9_-]` to prevent path traversal and shell injection
- `sessionId` — restricted to `[a-zA-Z0-9_/-]`
- `allowedTools` — restricted to known tool name patterns; arbitrary shell metacharacters are rejected
- `repoPath` — must be non-empty; routes check for `.git` existence before running git commands

### Child process spawning

All `claude` and `git` CLI invocations use **args arrays** (not shell-interpolated strings), so user-supplied values cannot inject shell commands. `shell: true` is still required on Windows for PATH resolution, but arguments are passed separately, not concatenated into a command string.

---

## What is NOT protected (by design)

Because Fleet runs locally and only you access it, the following are out of scope:

- **Authentication** — no login required; do not expose port 4000 externally
- **Rate limiting** — no throttling; you control the traffic
- **CSRF** — Fleet uses no session cookies; requests originate from the Fleet UI itself
- **Network encryption** — HTTP only on localhost; add a reverse proxy with TLS if you need remote access

---

## Do not expose Fleet to the internet

Fleet has no authentication. If you expose port 4000 externally (e.g. via `ngrok`, port forwarding, or a cloud VM), **anyone who reaches it can spawn Claude Code processes with your API key and access your local filesystem**.

If you need remote access (e.g. from a phone), use the built-in QR code feature which works on your **local network** only, or tunnel via an authenticated VPN.

---

## Reporting a vulnerability

If you find a security issue, please open a [GitHub issue](https://github.com/R093RT/Fleet/issues) with the label `security`. For sensitive disclosures, describe the general category without including a working exploit.
