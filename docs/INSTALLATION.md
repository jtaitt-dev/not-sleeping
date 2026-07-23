# Installation

## Release ZIP

Download `not-sleeping-<version>.zip` and its `.sha256` file from the matching
GitHub release. Verify the checksum, extract the ZIP, open
`chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and
choose the extracted directory.

## Source build

Install Node.js 22 LTS and pnpm 11, then run:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Load the generated `dist` directory from `chrome://extensions`.

On first run, enter a Sleeper username or use Demo mode. An OpenAI key is
optional. To update, replace the extracted release and reload the extension.
To remove it, use Chrome's **Remove** action; rotate any remembered key
separately if appropriate.
