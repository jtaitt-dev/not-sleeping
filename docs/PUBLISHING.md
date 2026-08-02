# Publishing

## Release build

From a clean checkout using Node 22 and pnpm 11:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm test:visual
pnpm zip
```

`artifacts/not-sleeping-<version>.zip` and
`artifacts/not-sleeping-<version>.sha256` are the
release deliverables. Verify the checksum independently before upload.

## Versioning

Update `package.json`, `wxt.config.ts`, and `CHANGELOG.md` together. Create a
signed or annotated `v<version>` tag only after CI passes. The release workflow
rebuilds, packages, checksums, and attaches artifacts to the GitHub release.

## Chrome Web Store

The project has not yet been submitted. Before submission:

1. Review every manifest permission and host permission.
2. Re-run privacy and threat-model review.
3. Confirm store disclosures match `docs/PRIVACY.md`.
4. Upload the generated Chrome ZIP.
5. Complete screenshots, description, support, and privacy fields without
   claiming affiliation with Sleeper or OpenAI.
6. Record the listing URL and review result in the changelog.
