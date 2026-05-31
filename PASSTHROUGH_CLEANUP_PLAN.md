# Passthrough Cleanup Plan

## 1. Scope

This document records a read-only cleanup dependency scan after Dennis moved its account-security browser-backed main chain to explicit `response_mode=passthrough`.

- Service repo: `/Users/pengcheng/dennis-local/browser-backed-api-poc`
- Service HEAD observed during scan: `13991c6f7ac3f7b1f388b7485b97204356197f92`
- Dennis repo: `/Users/pengcheng/dennis-risk-agent`
- Dennis HEAD used as migration baseline: `96d6ca90bb5e00437140970809a79f910952d356`
- No code deletion was performed.
- No real platform access was performed.
- No service startup was performed.
- No DataAgent / Hive call was performed.

Long-term target:

- Browser-backed service exposes only controlled passthrough.
- Service owns fixed actions, typed params, fixed origin/path, credential/output safety, and upstream body passthrough.
- Dennis / upper agents own parser, `normalized_observation`, `source_quality`, evidence card, and risk reasoning.

## 2. Scanned Paths

Focused service scan:

- `src/actions.js`
- `src/service.js`
- `src/quality.js`
- `src/browser.js`
- `test/mock.test.js`
- `README.md`
- `ACTION_REGISTRY.md`
- `BROWSER_BACKED_AGENT_SKILL.md`
- `PASSTHROUGH_SERVICE_CONTRACT.md`
- `TEAM_HANDOFF_CHECKLIST.md`

Focused Dennis scan:

- `computer_use_poc/browser_backed_service_client.py`
- `computer_use_poc/browser_backed_service_adapter_v1.md`
- `computer_use_poc/answer_experience_templates.md`
- `computer_use_poc/smoke_tests.md`
- `computer_use_poc/runtime_validation_cases_v1.yaml`
- `computer_use_poc/runtime_required_file_manifest_v1.yaml`
- `computer_use_poc/run_logs/*passthrough*`

## 3. Current Reference Inventory

Focused service scan counts:

| pattern | observed count |
| --- | ---: |
| `compat_summary` | 68 |
| `source_card` | 78 |
| `source_quality` | 72 |
| `response_mode` | 67 |
| combined cleanup regex across focused paths | 969 |

`compat_summary` references by file:

| file | count |
| --- | ---: |
| `ACTION_REGISTRY.md` | 26 |
| `README.md` | 12 |
| `PASSTHROUGH_SERVICE_CONTRACT.md` | 10 |
| `test/mock.test.js` | 11 |
| `src/actions.js` | 5 |
| `BROWSER_BACKED_AGENT_SKILL.md` | 4 |

`source_card/source_quality` references by file:

| file | count |
| --- | ---: |
| `test/mock.test.js` | 110 |
| `src/actions.js` | 16 |
| `README.md` | 12 |
| `BROWSER_BACKED_AGENT_SKILL.md` | 6 |
| `PASSTHROUGH_SERVICE_CONTRACT.md` | 4 |
| `ACTION_REGISTRY.md` | 2 |

## 4. Code Reference Summary

### `src/actions.js`

Current compatibility mechanisms:

- `DEFAULT_RESPONSE_MODE = "compat_summary"`
- `RESPONSE_MODES = ["compat_summary", "passthrough"]`
- Dual-mode actions keep `summarizeLiveResponse`, `summarizeParseFailureResponse`, or `summarizeFailureResponse`.
- `listActions()` advertises compat/source-card/source-quality response policies for dual-mode actions.
- `runMockAction()` returns legacy `source_card` / `source_quality` unless passthrough is explicitly requested.
- `buildLiveActionResponse()` parses upstream JSON and builds `data.response_summary`, `source_card`, and `source_quality`.
- `buildLiveActionFailureResponse()`, `buildActionParameterErrorResponse()`, and `buildActionDisabledByPlatformScopeResponse()` build legacy error responses with `source_card` / `source_quality`.
- `buildPassthroughActionResponse()` and `buildPassthroughFailureResponse()` already implement the target envelope.
- Numerous `summarize*` functions are service-side business summarizers and should not remain in the long-term service layer.

Current passthrough-only mechanisms:

- `PASSTHROUGH_ONLY_RESPONSE_MODES = ["passthrough"]`
- 7 recovered actions are already `passthroughOnly: true`.
- Passthrough responses do not include `source_card` or `source_quality`.

### `src/service.js`

Current compatibility mechanisms:

- `executeAction()` chooses the branch by `actionResponseMode(input, action)`.
- When `passthrough=true`, it returns passthrough responses and passthrough failures.
- When `passthrough=false`, it returns legacy summary responses and may run the login-log 7d parse-error fallback to 24h summary.

Keep:

- fixed action dispatch;
- platform scope checks;
- typed parameter validation;
- origin readiness and lazy rewarm status;
- passthrough failure mapping.

Candidate for deletion after gates:

- non-passthrough response branch;
- service-side login-log summary fallback;
- calls to `buildLiveActionResponse()` / `buildLiveActionFailureResponse()` / legacy parameter/disabled response builders.

### `src/quality.js`

Current compatibility mechanisms:

- `buildSourceCard()`
- `buildSourceQuality()`
- `summarizeJsonShape()`
- shape summary redaction helpers.

Long-term target:

- Remove from service runtime after no code imports it.
- Preserve any credential-denylist or raw-body safety logic only if it is still needed by the passthrough envelope. Do not delete security guards just because they share summary wording.

### `src/browser.js`

No service-summary builder dependency was identified in the focused scan. It should be treated as infrastructure and retained.

### `test/mock.test.js`

Current compatibility tests:

- action registry tests still assert dual-mode default `compat_summary` for legacy actions;
- legacy compat responses assert `source_card`, `source_quality`, `latency_ms`, and `sensitive_output=false`;
- explicit `compat_summary` keeps existing response shape;
- recovered passthrough actions reject `compat_summary`;
- many source-specific summary tests assert shape-only summaries, `source_card`, `source_quality`, and `no_data_not_risk_exclusion`.

These tests should be converted or deleted only after Dennis no longer relies on service summary fallback.

## 5. Service-side Deletion Candidates

Candidate group A: response mode defaults and registry metadata

- Change service default from `compat_summary` to `passthrough`.
- Remove `compat_summary` from `RESPONSE_MODES`.
- Remove dual-mode response policy fields:
  - `includes_source_card`
  - `includes_source_quality`
  - `compat_summary_includes_source_card`
  - `compat_summary_includes_source_quality`
- Keep `passthrough_includes_source_card=false` only if useful for short-term introspection; otherwise remove once docs are passthrough-only.

Candidate group B: legacy response builders

- `buildLiveActionResponse()`
- `buildLiveActionFailureResponse()`
- `buildActionParameterErrorResponse()` legacy body shape
- `buildActionDisabledByPlatformScopeResponse()` legacy body shape
- legacy `runMockAction()` branch that emits `source_card/source_quality`.

Replacement:

- passthrough success envelope;
- passthrough failure envelope;
- typed parameter errors and platform-disabled errors represented as passthrough failure responses.

Candidate group C: service-side summarizers

- `summarizeRcpSnapshotResponse`
- `summarizeWeaponInventoryResponse`
- `summarizeLoginLogsResponse`
- `summarizeLoginLogsParseFailureResponse`
- `summarizeLoginLogsFailureResponse`
- `summarizeTrackAnalysisResponse`
- `summarizeFixedShapeActionResponse`
- Archives/RCP parse-failure partial-summary helpers that construct service summaries.

These should move out of the service contract. Equivalent parser/normalizer behavior belongs in Dennis.

Candidate group D: `src/quality.js`

- Remove `buildSourceCard`.
- Remove `buildSourceQuality`.
- Remove `summarizeJsonShape` if no passthrough safety path still imports it.

Candidate group E: tests and docs

- Convert mock tests to assert passthrough envelopes only.
- Remove compat-summary-only fixtures after rollback window.
- Update `README.md`, `ACTION_REGISTRY.md`, `BROWSER_BACKED_AGENT_SKILL.md`, and `PASSTHROUGH_SERVICE_CONTRACT.md` from dual-mode wording to passthrough-only wording.

## 6. Temporarily Deferred Items

Do not delete in the first cleanup patch:

- `compat_summary` service support while Dennis explicit fallback remains available.
- Tests that prove explicit fallback still works during the migration window.
- Dual-run run logs and historical migration docs.
- `source_card/source_quality` references in historical docs or run logs.
- Any summary fixture used only for rollback comparison until the fallback deletion gate is passed.

Dennis-specific blockers to clear first:

- `BrowserBackedServiceClient.call_action()` still defaults to `compat_summary` for generic single-action legacy calls.
- `normalize_service_response()` still parses service summary payloads.
- Some Dennis fixture tests still expect service `source_card/source_quality`.
- First-batch four-source parsers are ready, but remaining dual-mode service actions need passthrough parser coverage or a generic fixed-shape normalizer before the service removes summaries globally.

## 7. Never Delete As Part Of Summary Cleanup

These are service safety / control-plane assets and must remain:

- passthrough envelope
- typed params validation
- forbidden input guard
- credential material denylist
- raw credential suppression checks
- response size guard
- fixed action allowlist
- origin registry
- auth-state manager
- browser same-origin execution guard
- action path/origin ownership
- README/setup/troubleshooting content that remains useful for service operation

If any helper is shared by summary and safety paths, split it before deletion.

## 8. Deletion Preconditions

Before deleting service summary/source-card/source-quality generation:

1. Dennis four-source passthrough dual-run has passed.
2. Dennis `full_runtime` controlled pilot has passed.
3. Dennis evidence card is fully usable from `normalized_observation`.
4. Dennis generic browser-backed calls no longer default to `compat_summary`.
5. Dennis self-tests no longer require service `source_card/source_quality` on the default path.
6. All service actions that Dennis may call have passthrough parser/generic normalizer coverage.
7. A second controlled pilot passes with fallback disabled.
8. Reference checks confirm no default-path dependency on service summary builders.

Current status:

- Preconditions 1-3 are satisfied for the first four-source account-security path.
- Preconditions 4-8 are not fully satisfied.

## 9. Recommended Deletion Sequence

### Phase A: mark deprecated, no deletion

- Update docs to call `compat_summary` deprecated legacy fallback.
- Keep dual-mode code and tests.
- Add explicit test marker that no new action may be `compat_summary` by default.

### Phase B: Dennis fallback migration

- Change Dennis generic `call_action()` default to passthrough or require explicit mode.
- Convert remaining Dennis fixture tests to passthrough parser/generic normalizer expectations.
- Rebuild `full_runtime`.
- Run controlled pilot with fallback disabled.

### Phase C: service summary code deletion

- Switch service action default to passthrough.
- Remove service-side summary response builders.
- Remove `src/quality.js` imports and delete it if unused.
- Remove `summarizeLiveResponse` callbacks from action registry entries.
- Remove service login-log summary fallback.

### Phase D: compat tests deletion

- Delete or archive compat-summary mock tests.
- Keep tests that passthrough-only rejects credential output and forbidden params.
- Keep tests that passthrough failure mapping is stable.

### Phase E: docs become passthrough-only

- Rewrite `README.md`.
- Rewrite `ACTION_REGISTRY.md`.
- Rewrite `PASSTHROUGH_SERVICE_CONTRACT.md`.
- Rewrite `BROWSER_BACKED_AGENT_SKILL.md`.
- Keep historical run logs as migration evidence.

## 10. Risks

- Removing service `source_card/source_quality` before Dennis parser coverage is complete would break non-four-source callers.
- Removing `src/quality.js` without splitting safety helpers could accidentally remove raw-body and credential suppression assertions.
- Removing service login-log fallback before Dennis owns an equivalent fallback could reduce resilience for legacy explicit compat callers.
- Updating docs before code may mislead callers about the still-present dual-mode behavior.
- Deleting compat tests too early removes rollback assurance during the pilot window.

## 11. Recommended Commit Split

1. `mark compat summary deprecated in browser backed service`
   - docs and registry wording only.
2. `make browser backed mock defaults passthrough`
   - test/mocking path cleanup after Dennis fallback migration.
3. `remove browser backed service summary builders`
   - code deletion for `buildLiveActionResponse`, summary callbacks, and `src/quality.js` when unused.
4. `remove compat summary tests`
   - test suite cleanup after controlled pilot.
5. `document passthrough only service contract`
   - final docs pass.

## 12. Current Recommendation

Proceed with Phase A only.

Do not start Phase C deletion until Dennis completes fallback migration and another `full_runtime` controlled pilot passes with service-side summary assumptions removed from the default path.
