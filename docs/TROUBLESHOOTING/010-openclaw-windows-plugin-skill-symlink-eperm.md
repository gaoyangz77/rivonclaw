# TS-010: OpenClaw Windows Plugin Skill Symlink EPERM

Date: 2026-05-14

## Summary

On Windows, OpenClaw may warn that it failed to create a plugin skill symlink
under `plugin-skills`. This is usually caused by Windows directory symlink
privileges, not by a failed plugin load or a crashed gateway.

Observed example:

```text
[skills] failed to create plugin skill symlink "C:\Users\1\.rivonclaw\openclaw\plugin-skills\browser-automation" → "C:\Program Files\RivonClaw\resources\vendor\openclaw\dist-runtime\extensions\browser\skills\browser-automation": Error: EPERM: operation not permitted, symlink ...
```

## Symptoms

- Gateway startup succeeds.
- `browser`, `rivonclaw-cloud-tools`, and other configured plugins still load.
- Logs contain repeated `failed to create plugin skill symlink ... EPERM`
  warnings.
- The affected generated path is typically:

```text
C:\Users\<user>\.rivonclaw\openclaw\plugin-skills\browser-automation
```

## Impact

Current impact is limited. OpenClaw still resolves plugin skill directories
through its plugin metadata path, so this warning does not by itself prove that
the browser plugin, cloud tools, or agent tool execution are broken.

The practical risk is that code paths expecting the generated
`plugin-skills/<skill-name>` symlink may not see the skill at that stable path.
For the observed `browser-automation` case, this is not currently considered a
release blocker.

## Root Cause

OpenClaw publishes plugin skills by creating directory symlinks in the state
directory. On Windows, creating directory symlinks can fail with `EPERM` unless
the process has the required symlink privilege, runs elevated, or the machine is
configured to allow developer symlinks.

This differs from ordinary file writes and is not the same issue as TS-009's
Windows media `fsync` failure.

## Status

Known issue. We are not carrying a RivonClaw vendor patch at this time because
the observed failure is non-fatal and OpenClaw still has alternate plugin skill
resolution paths.

A reasonable upstream fix would be for OpenClaw to fall back to a Windows
directory junction when directory symlink creation fails with `EPERM` or
`EACCES`.

## Workarounds

- Ignore the warning if gateway startup, plugin activation, and tool execution
  are otherwise healthy.
- If a user-visible browser skill failure is confirmed, retry with Windows
  Developer Mode enabled or by running RivonClaw elevated to confirm the symlink
  privilege hypothesis.

## Escalation Criteria

Treat this as actionable if logs show one of the following in addition to the
symlink warning:

- Browser plugin activation fails.
- The `browser` tool is missing from effective tools.
- Agents repeatedly fail with missing `browser-automation` skill instructions.
- Cloud tools or ecommerce tools are missing from effective tools.

