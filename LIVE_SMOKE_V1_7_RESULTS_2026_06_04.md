# Live Smoke V1.7 Results - 2026-06-04

Scope: controlled seeded smoke for current browser-backed service code with
`action_count=70`.

This run used recent live seeds instead of historical HAR parameters. Full
upstream bodies were not printed. Only transport envelope summaries and derived
follow-up identifiers are recorded.

## Service Health

- service_mode: `live`
- action_count: `70`
- auth_state: `ready`
- profile_exists: `true`
- credential_material_output observed: `false`
- origins ready:
  - `rcp`
  - `weapon`
  - `login_logs`
  - `archives`
  - `track_analysis`

## User Seed

- user_id: `2892617234`
- login_logs window: recent 7 days
- archives window: recent 7 to 30 days depending on action
- RCP seed: recent `USER_REGISTER_NEW` event sample from `rcp_snapshot`

## Result Summary

| action | live_status | http_status | body | bytes | derived seed | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `track_analysis_summary` | `live_pass` | `200` | visible | `615` | no device id exposed | Profile subinterface returned JSON. |
| `track_sequence_get_device_ids` | `live_pass` | `200` | visible | `82` | no device id exposed | No follow-up device seed available for this user in bounded body. |
| `login_logs_search` | `live_pass` | `200` | visible | `313679` | n/a | JSON API body returned; no HTML shell; no timeout. |
| `weapon_inventory` | `live_pass` | `200` | visible | `242` | n/a | Graph/risk call completed. |
| `archives_user_profile` | `live_pass` | `200` | visible | `196` | n/a | Transport/API shape completed. |
| `archives_user_analysis` | `live_pass` | `200` | visible | `196` | n/a | Transport/API shape completed for recent 7-day window. |
| `archives_photo_search` | `live_no_data` | `200` | visible | `196` | no `photo_id` exposed | No photo follow-up seed from report search for this user/window. |
| `archives_gallery_photo_list` | `live_no_data` | `200` | visible | `196` | no `photo_id` exposed | No gallery follow-up seed for this user. |
| `archives_live_gallery` | `live_no_data` | `200` | visible | `196` | no `live_stream_id` exposed | No live follow-up seed for this user. |
| `track_analysis_check_data_ready` | `live_param_seed_needed` | n/a | n/a | n/a | no `device_id` | Skipped because Track seed actions did not expose a device ID. |
| `track_sequence_get_use_duration` | `live_param_seed_needed` | n/a | n/a | n/a | no `device_id` | Skipped because Track seed actions did not expose a device ID. |
| `track_sequence_dimension_list` | `live_pass` | `200` | visible | `1677` | n/a | Auxiliary Track enum action completed. |
| `rcp_snapshot` | `live_pass` | `200` | visible | `33748` / `42192` | event seed derived | Recent event sample derived from live body. |
| `rcp_event_detail` | `live_timeout` | n/a | omitted | `0` | event seed used | Returned `navigation_timeout`; needs retry or timeout-stage follow-up. |
| `rcp_event_feature_list` | `live_pass` | `200` | visible | `235985` | feature key `deviceId` | Follow-up succeeded with live `eventId/queryTime`. |
| `rcp_feature_info_by_keys` | `live_pass` | `200` | visible | `1557` | `featureKeys=deviceId` | Feature info follow-up succeeded. |
| `rcp_event_tree_or_decision` | `live_pass` | `200` | visible | `224` | event seed used | Event tree/decision follow-up succeeded. |

## Derived RCP Sample

- eventType: `USER_REGISTER_NEW`
- eventId: `961539058235700645`
- sourceId: `0`
- queryTime: `1780559399560`
- first feature key used for feature-info follow-up: `deviceId`

## Incomplete / Follow-Up Needed

- Archives photo/live follow-up actions were not called in this run because
  current seed actions did not expose `photo_id` or `live_stream_id` for
  `user_id=2892617234`.
- Track device follow-up actions were not called because Track seed actions did
  not expose a `device_id` for this user.
- `rcp_event_detail` timed out once with the live-derived event sample. Other
  RCP follow-ups for the same sample succeeded, so this is not an auth/profile
  failure.

## Safety Check

- request headers output: `false`
- credential material output: `false`
- transport auth material output: `false`
- full upstream body printed in this log: `false`
- arbitrary URL fetch used: `false`
- DataAgent/Hive used: `false`
