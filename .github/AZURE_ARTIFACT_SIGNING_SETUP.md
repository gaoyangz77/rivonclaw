# Azure Artifact Signing Setup

RivonClaw signs Windows release artifacts with Azure Artifact Signing
(formerly Trusted Signing) during `electron-builder` packaging. Signing during
packaging keeps `latest.yml` and `.blockmap` metadata aligned with the final
signed NSIS installer and portable executable.

## Current Azure Resource

| Field | Value |
| --- | --- |
| Resource group | `rg-rivonclaw-signing` |
| Artifact Signing account | `rivonclaw-signing` |
| Region | `East US` |
| Endpoint | `https://eus.codesigning.azure.net` |
| Pricing tier | `Basic (9.99 USD/month)` |
| Certificate profile expected by CI | `rivonclaw-public-trust` |

## Azure Setup Still Required

1. In the `rivonclaw-signing` account, complete identity validation.
   Use `Public Trust` and organization/company validation for `RIVON LLC`.
2. Create a certificate profile named `rivonclaw-public-trust`.
3. Create a Microsoft Entra application/service principal for GitHub Actions.
4. Assign that principal the `Artifact Signing Certificate Profile Signer` role
   scoped to the certificate profile or signing account.
5. Add these GitHub Actions secrets:

| Secret | Value |
| --- | --- |
| `AZURE_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_CLIENT_ID` | Application/client ID for the CI signing principal |
| `AZURE_CLIENT_SECRET` | Client secret for the CI signing principal |

## Pipeline Behavior

The Windows release job runs:

```bash
cd apps/desktop
pnpm run dist:win
```

`apps/desktop/electron-builder.win.yml` provides `azureSignOptions`, so
electron-builder installs the `TrustedSigning` PowerShell module and signs the
Windows app executable, NSIS installer, and portable executable through Azure
Artifact Signing.

After packaging, the workflow verifies every generated `.exe` with
`Get-AuthenticodeSignature` and fails the release if any signature is not valid.
Until all three `AZURE_*` secrets are configured, CI deliberately uses the
unsigned Windows fallback config so macOS/Linux releases are not blocked by the
unfinished Windows signing setup.

## Notes

- Basic tier allows 5,000 signatures/month, then charges $0.005 per extra
  signature.
- Artifact Signing certificates are short lived, so the config uses the
  Microsoft timestamp server: `http://timestamp.acs.microsoft.com`.
- The account and certificate profile must be in the same Azure region as the
  endpoint configured in `electron-builder.win.yml`.

## References

- Microsoft Learn: [Quickstart: Set up Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
- Microsoft Learn: [Set up signing integrations to use Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations)
- electron-builder: [WindowsAzureSigningConfiguration](https://www.electron.build/docs/api/app-builder-lib.interface.windowsazuresigningconfiguration/)
