# Remote Main Agent + Mac Local Worker Trial V1.5

## Trial Summary

| Field | Result |
| --- | --- |
| release | `browser_backed_risk_service_team_trial_v1_5` |
| mode | Remote Main Agent + Mac Local Worker |
| Skill loaded successfully | yes |
| Mac worker path | `~/bbrs_v15/browser_backed_risk_service_team_trial_v1_5` |
| worker:doctor passed | yes |
| service_mode | `live` |
| auth_state | `ready` |
| action_count | `19` |
| ready_for_agent_use | true |

## Origin Readiness

| Origin | Status |
| --- | --- |
| rcp | ready |
| weapon | ready |
| login_logs | ready |
| archives | ready |
| track_analysis | ready |

## Smoke Results

| Action | Result |
| --- | --- |
| `track_analysis_summary` | smoke passed |
| `archives_private_message_search` | smoke passed |

## Safety Check

| Check | Result |
| --- | --- |
| `credential_material_output` | false |
| `sso_session.py` used | false |
| cookie injection used | false |
| storageState injection used | false |
| profile copy to Linux used | false |
| arbitrary URL fetch used | false |

## Conclusion

Remote Main Agent + Mac Local Worker Mode is the current validated path.
Daily use should keep the Mac worker running and let the main agent call
service actions.

No Chrome profile copy to Linux is required.
