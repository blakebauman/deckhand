# Supply chain (E-lite)

Deckhand aims to be trustworthy for internal dogfood without Desktop Business–depth enterprise controls.

## Practices

- **Audit log** — security-relevant sidecar actions append to `~/.deckhand/audit.jsonl` (`GET /api/audit`).
- **Secret redaction** — Kubernetes Secrets API returns key names only, never values.
- **Confirm destructive ops** — UI confirms prune/remove when preference enabled.
- **Proxy env** — Docker SDK and CLI helpers inherit `HTTP_PROXY` / `HTTPS_PROXY` (shown in Diagnose).
- **SBOM** — generate a CycloneDX-ish inventory of Go modules for the sidecar:

```bash
cd sidecar && go list -m -json all > ../dist/sidecar-modules.json
```

- **Signed releases** — when publishing internal builds, sign the `.dmg` / `.deb` / AppImage with your org’s code-signing identity (Apple notarization / Linux package signing). Document the identity in the release notes; CI should attach checksums (`sha256sum`).

## Out of scope until sponsored (E-deep)

SSO, MDM `admin-settings.json`, registry allowlists, air-gap enforcement, ECI-class isolation.
