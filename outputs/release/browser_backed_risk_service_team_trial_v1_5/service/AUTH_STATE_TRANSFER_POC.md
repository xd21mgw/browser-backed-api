# Auth State Transfer POC

Auth State Transfer is a candidate path under validation. It is not currently a
recommended team deployment mode and it is not rejected as impossible.

## Goal

The goal is to determine whether a same-user, bounded auth state can be
activated on Mac and then loaded by the main Agent machine so the browser-backed
service can run locally there without keeping a Mac worker online.

This is different from copying a full Chrome profile directory to Linux.

## Current Position

- Mac Local Worker remains the stable recommended path for remote main Agents.
- Auth State Transfer is a POC candidate.
- Do not present it to teammates as the normal workflow.
- Do not treat it as failed or successful until a controlled validation is
  complete.

## Safety Boundary

Auth State Transfer experiments must follow these rules:

- Same user only.
- Do not cross-share auth state between users.
- Do not print auth state contents.
- Do not commit auth state files.
- Do not upload cookies, tokens, sessions, request headers, passwords, profile
  directories, localStorage dumps, browser storage dumps, or Playwright
  storageState to git or chat.
- Do not let the Agent inspect auth material.
- Do not add arbitrary URL fetch.
- Do not bypass SSO, two-factor checks, captcha, or platform permissions.

## POC Questions

1. Can a bounded same-user auth state be loaded by the service on the main Agent
   machine?
2. Can `refresh:once`, `/prewarm`, and action-stage ensure-ready operate with
   that state without reading or outputting authentication material?
3. Can the service handle lightweight landing flow when it is only username
   prefilled plus `Next` / `Continue` / `Confirm`?
4. Does the main Agent avoid directly viewing pages or clicking UI controls?
5. When the state expires, can Mac re-bootstrap the state in a controlled way?
6. Does this reduce dependency on a long-running Mac worker without weakening
   safety boundaries?

## Success Criteria

- `/health ok=true`
- `action_count=19`
- required origins ready for the target workflow
- stable actions can be called through fixed action + typed params
- no credential material output
- bounded upstream business body is available for main-Agent parsing without
  printing full body by default
- no cookie/token/session/header/profile/storage dump
- lightweight landing flow is handled in readiness/prewarm/ensure-ready only

## Failure Criteria

- RCP, Weapon, Login Logs, or Archives repeatedly trigger `two_factor_required`
  in the main Agent environment.
- The service cannot handle lightweight account confirmation without user
  intervention.
- The POC requires cookie injection, storageState injection, `sso_session.py`,
  Chrome cookie DB reads, or profile directory sharing.
- The Agent needs to read auth material or raw browser storage.
- The POC encourages users to copy full Chrome profile directories to Linux as a
  normal workflow.

## Relationship To Mac Local Worker

Mac Local Worker remains the recommended remote-main-agent deployment until this
POC is proven.

If Auth State Transfer succeeds, it can become a v1.6 focus area or a new
recommended mode. If it fails, the fallback remains Mac Local Worker.

## Not Implemented In This Release

This release documents the POC and validation criteria. It does not implement a
full Auth State Transfer runtime.
