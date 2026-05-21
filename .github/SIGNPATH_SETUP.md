# Historical SignPath Foundation Free Code Signing Setup Guide

> Historical note: RivonClaw is now maintained as a private/proprietary
> repository. The SignPath Foundation open-source program requirements below no
> longer apply unless the project is opened again. The remaining contents are
> kept only as historical reference.

SignPath Foundation provides **completely free** Windows code signing for open source projects.

## 📋 Prerequisites

- ✅ Public repository on GitHub
- ✅ OSI-approved open source license (MIT ✅)
- ✅ Automated builds using GitHub Actions

## 🚀 Application Steps

### 1. Register for SignPath Account

Visit: https://about.signpath.io/product/open-source

Click **"Apply for Free Code Signing"**

### 2. Fill Out Application Form

Provide the following information:

```
GitHub Repository: https://github.com/gaoyangz77/rivonclaw
Project Name: RivonClaw
Open Source License: MIT License
Project Description: RivonClaw is a desktop app that provides visual permission
                     control for OpenClaw, making it easy to manage LLM providers,
                     API keys, and permissions through a clean UI.
Build Method: GitHub Actions
Contact Email: [your email]
```

### 3. Wait for Review

- Review time: Usually 1-3 business days
- SignPath team will verify the project meets open source requirements
- You'll receive an email notification with API token upon approval

### 4. Configure GitHub Secrets

After approval, add the following secrets in your GitHub repository:

```
Settings → Secrets and variables → Actions → New repository secret
```

Required secrets:

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `SIGNPATH_API_TOKEN` | API access token | From SignPath approval email |
| `SIGNPATH_ORGANIZATION_ID` | Organization ID | From SignPath dashboard |

### 5. Configure SignPath Project

In the SignPath dashboard:

1. **Create Project**
   - Project name: `rivonclaw`
   - Project type: Electron App

2. **Configure Artifact Configuration**
   - Name: `windows-installer`
   - File type: Portable Executable (`.exe`)
   - Signing policy: Choose appropriate policy for Electron apps

3. **Configure Signing Policy**
   - Name: `release-signing`
   - Approval requirements: Set according to needs (open source projects typically use auto-approval)
   - Certificate: Use the shared certificate provided by SignPath Foundation

### 6. Update GitHub Actions Workflow

Uncomment the signing steps in `.github/workflows/build.yml`:

```yaml
# Find the commented section and remove the # symbols
- name: Submit to SignPath for signing
  uses: signpath/github-action-submit-signing-request@v1
  with:
    api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
    organization-id: ${{ secrets.SIGNPATH_ORGANIZATION_ID }}
    project-slug: 'rivonclaw'
    signing-policy-slug: 'release-signing'
    artifact-configuration-slug: 'windows-installer'
    input-artifact-path: 'apps/desktop/release/RivonClaw-Setup.exe'
    output-artifact-path: 'apps/desktop/release/RivonClaw-Setup-Signed.exe'
```

### 7. Test the Signing Workflow

Trigger the build manually via GitHub Actions:

1. Go to **Actions > Build & Release > Run workflow**
2. Click **Run workflow** on the `main` branch

Check the GitHub Actions run results.

## 🍎 macOS Signing (Requires Payment)

macOS signing requires Apple Developer Program ($99/year) - there's no free alternative.

### Steps After Purchase:

1. **Obtain Certificate**
   ```bash
   # Export .p12 certificate from Keychain Access
   # Convert to Base64 for GitHub Secrets
   base64 -i certificate.p12 | pbcopy
   ```

2. **Add GitHub Secrets**
   ```
   MACOS_CERTIFICATE          # Base64 string copied above
   MACOS_CERTIFICATE_PWD      # Certificate password
   KEYCHAIN_PASSWORD          # Any strong password (for temporary keychain)
   APPLE_ID                   # Apple ID email
   APPLE_APP_SPECIFIC_PASSWORD # Generate from appleid.apple.com
   APPLE_TEAM_ID              # 10-character team ID
   ```

3. **Enable Signing**

   Modify `apps/desktop/electron-builder.yml`:
   ```yaml
   mac:
     identity: "Developer ID Application: Your Name (TEAM_ID)"
     notarize: true  # Change to true
   ```

## 📝 Important Notes

### SignPath Usage Limits

- ✅ Signing count: Unlimited
- ✅ Build frequency: Reasonable (recommend signing only on releases)
- ✅ Certificate type: EV certificate provided by SignPath Foundation
- ⚠️ Requirement: All signing must go through GitHub Actions, no local signing

### Signing Effective Time

- Windows (SignPath): Effective immediately after signing, no SmartScreen warning
- macOS (Apple): Notarization takes 5-15 minutes

### Debugging Tips

If signing fails, check:

1. Error messages in GitHub Actions logs
2. Signing request status in SignPath dashboard
3. Ensure file paths are correct (`RivonClaw-Setup.exe` vs `RivonClaw Setup.exe`)

## 🔗 Useful Links

- SignPath Website: https://signpath.io
- SignPath Documentation: https://about.signpath.io/documentation
- GitHub Action: https://github.com/signpath/github-action-submit-signing-request
- Apple Notarization Guide: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution

## ❓ FAQ

**Q: Is SignPath permanently free?**
A: Yes, as long as the project remains open source.

**Q: Can I use my own certificate?**
A: SignPath Foundation uses a shared EV certificate and doesn't support custom certificates. For custom certificates, you need SignPath's commercial version.

**Q: Can macOS be signed for free?**
A: No, Apple doesn't offer free signing for open source projects. You must purchase Apple Developer ($99/year).

**Q: Will users still see warnings after signing?**
A: SignPath uses an EV certificate, so Windows SmartScreen won't show warnings. macOS requires Apple Developer purchase and notarization to avoid warnings.
