# Action Concurrency Inventory

Date: 2026-06-24

## Read-Only Audit Conclusion

The service is not globally serialized today.

- Single `/actions/<action>` requests enter `BrowserBackedApiService.executeAction()` directly. There is no global action mutex, per-origin lock, page lock, or profile lock in that path.
- `/actions/batch` has a conflict-aware scheduler. `independent_parallel` groups are split into lanes, but any `page_followup` action and any `archives` action are currently placed into the shared `browser_session_exclusive` lane.
- Browser profile lifecycle and manual-login safety are handled by `scripts/mac-worker.js` profile-lock checks. Those are process/startup guards, not action-dispatch locks.
- `BrowserBackedClient` maintains one persistent browser context and a shared page per origin in `pages`. `page_followup` actions call `page.evaluate()` on that shared page and are page-bound.
- `context_request` actions use `context.request.fetch()` against fixed origin/path requests. They do not depend on DOM state in the normal path, but every live action still runs the freshness guard and can trigger origin prewarm/rewarm before fetching.

The previous "must be serial" limitation is therefore not purely source-wide. It is action/page-state-wide in direct action execution, with a conservative source-wide treatment for Archives in batch. For Archives specifically, current code routes all Archives actions through `context_request`, but it force-rewarms Archives before actions and can retry after upstream business-auth responses. Because those rewarm/retry paths mutate the shared Archives page readiness state, Archives should remain per-origin serial until there is evidence that concurrent Archives context requests do not race the shared page/auth state.

## Current Execution Model

| Path | Current concurrency behavior |
| --- | --- |
| `GET /health`, `GET /actions` | No action execution. |
| `POST /prewarm` | Sequentially prewarms enabled origins. No global lock against concurrent actions. |
| `POST /actions/<action>` | No scheduler or lock today. Concurrent HTTP callers can overlap. |
| `POST /actions/batch` with serial modes | Group sources run serially. |
| `POST /actions/batch` with `independent_parallel` | Sources run in conflict-aware lanes. `page_followup` and `archives` share one serial lane; other sources run independently. |

## Proposed Lock Matrix

| Category | Examples | Lock scope | Rationale |
| --- | --- | --- | --- |
| Global auth/profile lifecycle | `worker:start`, `open:profile`, full `/prewarm`, manual login, profile lock recovery | `global` | These can open/close browser contexts, require user interaction, or mutate all origin readiness. |
| Page-bound actions | `login_logs_search`, `weapon_inventory` | `per_origin` | They use a shared page and `page.evaluate()`; concurrent calls can race DOM/page/session state. |
| Archives context requests | all `archives_*` actions | `per_origin` by default | They are `context_request`, but action-stage force rewarm and auth retry mutate shared Archives page readiness. |
| Pure context requests | most `rcp_*`, `weapon_device_*`, `track_*` | `none` plus global bounded pool | Fixed same-origin API requests through browser context; no DOM mutation in normal path. |
| Large/timeout-sensitive requests | `rcp_fast_query_hbase`, `archives_user_analysis`, `weapon_inventory` | same lock as category, with longer timeout/batch planning | Serializing is for state safety, not performance; large response handling remains bounded passthrough. |

Default recommended limits: global action pool `4`; per-origin/page locks `1`.

## Archives Detail

| Archives action | Current execution | Required lock | Future parallel candidate | Reason |
| --- | --- | --- | --- | --- |
| `archives_user_profile` | `context_request` | `per_origin` | yes, after proving no rewarm/auth retry race | Reads fixed profile endpoint but shares Archives freshness/rewarm state. |
| `archives_photo_profile` | `context_request` | `per_origin` | yes, after proving no rewarm/auth retry race | Fixed photo endpoint; passthrough body. |
| `archives_photo_meta` | `context_request` | `per_origin` | yes, after proving no rewarm/auth retry race | Fixed photo endpoint; passthrough body. |
| `archives_gallery_photo_list` | `context_request` | `per_origin` | yes, after proving no rewarm/auth retry race | Fixed gallery endpoint; potentially large response. |
| `archives_private_message_search` | `context_request` | `per_origin` | yes, but keep conservative | Fixed endpoint; source may be large and privacy-sensitive passthrough. |
| `archives_user_analysis` | `context_request` | `per_origin` | low priority | Heavy/timeout-sensitive action timeline endpoint; keep serial. |
| Other `archives_*` actions | `context_request` | `per_origin` | case-by-case | Conservative default because Archives has same-origin landing-flow and business-auth retry behavior. |

## Action Inventory

| action_name | source/origin | execution_type | uses_shared_page | uses_browser_context_request | requires_rewarm | can_parallelize | required_lock_scope | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rcp_snapshot | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| weapon_inventory | weapon | page_followup | yes | no | yes, freshness guard | serial-within-scope | per_origin | page-followup via shared Weapon page.evaluate; graphData plus optional riskData chain |
| weapon_device_info | weapon | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| weapon_device_app_list | weapon | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| weapon_device_location_info | weapon | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| weapon_user_klink_status | weapon | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| login_logs_search | login_logs | page_followup | yes | no | yes, freshness guard | serial-within-scope | per_origin | page-followup; same login_logs page can look ready while stale; action has rewarm/retry behavior |
| track_analysis_summary | track_analysis | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| archives_user_analysis | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_user_profile | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_photo_search | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_photo_profile | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_photo_meta | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_photo_report_aggregate | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_photo_user_autonomy | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_gallery_photo_list | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_photo_gallery_top | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_negative_report | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_negative_uninterested | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_risk_info | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_user_label | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_user_shop_info | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_punish_status | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_review_logs | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_user_analyze_summary | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_live_gallery | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_fans_list | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_follow_list | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_collect_photo_list | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_collection_list | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_comment_search | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_livestream_home_info | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_livestream_home_meta | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_livestream_home_log | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_livestream_comment_statistics | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_livestream_comment_detail | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_user_report_search | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_moment_list | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_related_users | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_private_message_search | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| archives_past_four_items | archives | context_request | no | yes | yes, freshness guard | serial-within-scope | per_origin | Archives is context_request today, but shares auth/landing/page readiness state; keep per-origin serial by default |
| rcp_event_detail | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_event_feature_list | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_event_tree_or_decision | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_fast_query_hbase | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_feature_info_by_keys | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_basic_info | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_relation_policy_tree | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_binding_info_list | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_search | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_blur_search | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_all_version | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_pipeline_policy_versions_by_code | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_tree_list | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_tree_node_binding | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_tree_policy_codes | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_tree_max_version | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_event_type_list | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_realtime_op_list | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_event_query_max_duration | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_event_save_ratios | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_version_lookup | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_detail_lookup | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_release_record_lookup | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_policy_tree_lookup | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_node_policy_attribution | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| rcp_node_bind_policy_attribution | rcp | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| track_analysis_check_data_ready | track_analysis | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| track_analysis_product_list | track_analysis | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| track_sequence_dimension_list | track_analysis | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| track_data_type_list | track_analysis | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| track_sequence_get_device_ids | track_analysis | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| track_sequence_get_use_duration | track_analysis | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
| track_sequence_profile | track_analysis | context_request | no | yes | yes, freshness guard | yes | none | fixed browser context request to a fixed origin/path; no DOM/page mutation in normal path |
