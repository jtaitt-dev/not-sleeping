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

Update `package.json` and `CHANGELOG.md` together; WXT derives the manifest
version from the package. Create a signed or annotated `v<version>` tag only
after CI passes. The release workflow
rebuilds, packages, checksums, and attaches artifacts to the GitHub release.

## Chrome Web Store

The current unified artifact includes gated manual-odds research. It is a
limited-beta/sideload deliverable and is **not currently approved for Chrome Web
Store submission**. Runtime gates reduce exposure but do not remove packaged
code from store review.

Before any future submission:

1. Obtain current Chrome Web Store policy and legal review of the manual-odds
   feature and distribution jurisdictions.
2. Review every manifest permission, host permission, and packaged feature.
3. Re-run privacy, security, and threat-model review.
4. Confirm store disclosures match `PRIVACY.md` and actual behavior.
5. Complete screenshots, description, support, and privacy fields without
   claiming affiliation with Sleeper or OpenAI.
6. Upload only after the review explicitly approves the unified package.
7. Record the listing URL and review result in the changelog.
