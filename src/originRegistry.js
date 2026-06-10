export const DEFAULT_REFRESH_TTL_MS = 4 * 60 * 60 * 1000;

export const CORE_ORIGIN_KEYS = Object.freeze([
  "rcp",
  "weapon",
  "login_logs",
  "track_analysis"
]);

export const ORIGIN_REGISTRY = Object.freeze({
  rcp: freezeOrigin({
    name: "rcp",
    label: "RCP",
    envVar: "RCP_ORIGIN",
    warmupEnvVar: "RCP_PREWARM_PATH",
    defaultOrigin: "https://rcp.corp.kuaishou.com",
    warmupPath: "/",
    actions: [
      "rcp_snapshot",
      "rcp_event_detail",
      "rcp_event_feature_list",
      "rcp_event_tree_or_decision",
      "rcp_fast_query_hbase",
      "rcp_feature_info_by_keys",
      "rcp_policy_basic_info",
      "rcp_relation_policy_tree",
      "rcp_policy_binding_info_list",
      "rcp_policy_search",
      "rcp_policy_blur_search",
      "rcp_policy_all_version",
      "rcp_pipeline_policy_versions_by_code",
      "rcp_policy_version_lookup",
      "rcp_policy_detail_lookup",
      "rcp_policy_release_record_lookup",
      "rcp_policy_tree_lookup",
      "rcp_node_policy_attribution",
      "rcp_node_bind_policy_attribution"
    ],
    refreshTtlMs: DEFAULT_REFRESH_TTL_MS,
    enabled: true,
    requiredForHealth: true,
    requiredForRefresh: true,
    optional: false
  }),
  weapon: freezeOrigin({
    name: "weapon",
    label: "Weapon",
    envVar: "WEAPON_ORIGIN",
    warmupEnvVar: "WEAPON_PREWARM_PATH",
    defaultOrigin: "https://weapon-platform.corp.kuaishou.com",
    warmupPath: "/",
    actions: ["weapon_inventory"],
    refreshTtlMs: DEFAULT_REFRESH_TTL_MS,
    enabled: true,
    requiredForHealth: true,
    requiredForRefresh: true,
    optional: false
  }),
  login_logs: freezeOrigin({
    name: "login_logs",
    label: "Login Logs",
    envVar: "LOGIN_LOGS_ORIGIN",
    warmupEnvVar: "LOGIN_LOGS_PREWARM_PATH",
    defaultOrigin: "https://user-center-workbench.corp.kuaishou.com",
    warmupPath: "/",
    actions: ["login_logs_search"],
    refreshTtlMs: DEFAULT_REFRESH_TTL_MS,
    enabled: true,
    requiredForHealth: true,
    requiredForRefresh: true,
    optional: false
  }),
  archives: freezeOrigin({
    name: "archives",
    label: "Archives Center",
    envVar: "ARCHIVES_ORIGIN",
    warmupEnvVar: "ARCHIVES_PREWARM_PATH",
    defaultOrigin: "https://admin.p.adm-corp.kuaishou.com",
    warmupPath: "/frontend/archives/index.html",
    actions: [
      "archives_user_analysis",
      "archives_user_profile",
      "archives_photo_search",
      "archives_photo_profile",
      "archives_photo_meta",
      "archives_photo_report_aggregate",
      "archives_photo_user_autonomy",
      "archives_gallery_photo_list",
      "archives_related_users",
      "archives_private_message_search",
      "archives_past_four_items"
    ],
    refreshTtlMs: DEFAULT_REFRESH_TTL_MS,
    enabled: true,
    requiredForHealth: false,
    requiredForRefresh: false,
    optional: true,
    landingFlow: {
      sameOriginActivation: true,
      maxClicks: 2,
      allowedLabels: ["下一步", "继续", "确认", "进入系统", "登录", "Continue", "Next", "Confirm"]
    }
  }),
  track_analysis: freezeOrigin({
    name: "track_analysis",
    label: "Track Analysis",
    envVar: "TRACK_ANALYSIS_ORIGIN",
    warmupEnvVar: "TRACK_ANALYSIS_PREWARM_PATH",
    defaultOrigin: "https://track-analysis.corp.kuaishou.com",
    warmupPath: "/",
    actions: [
      "track_analysis_summary",
      "track_analysis_check_data_ready",
      "track_analysis_product_list",
      "track_sequence_dimension_list",
      "track_data_type_list"
    ],
    refreshTtlMs: DEFAULT_REFRESH_TTL_MS,
    enabled: true,
    requiredForHealth: true,
    requiredForRefresh: true,
    optional: false
  }),
  data_agent: freezeOrigin({
    name: "data_agent",
    label: "Data Agent",
    envVar: "DATA_AGENT_ORIGIN",
    warmupEnvVar: "DATA_AGENT_PREWARM_PATH",
    defaultOrigin: "https://tc.corp.kuaishou.com",
    warmupPath: "/data-agent",
    actions: [],
    refreshTtlMs: DEFAULT_REFRESH_TTL_MS,
    enabled: true,
    requiredForHealth: false,
    requiredForRefresh: false,
    optional: true
  })
});

export function listOriginDefinitions(registry = ORIGIN_REGISTRY) {
  return Object.values(registry);
}

export function getOriginDefinition(name, registry = ORIGIN_REGISTRY) {
  return registry[name] || null;
}

export function listOriginKeys(registry = ORIGIN_REGISTRY) {
  return listOriginDefinitions(registry).map((origin) => origin.name);
}

export function listEnabledOriginKeys(registry = ORIGIN_REGISTRY) {
  return listOriginDefinitions(registry)
    .filter((origin) => origin.enabled !== false)
    .map((origin) => origin.name);
}

function freezeOrigin(origin) {
  const actions = Object.freeze([...(origin.actions || [])]);
  const optional = Boolean(origin.optional);
  return Object.freeze({
    ...origin,
    optional,
    actions,
    requiredForActions: Object.freeze([...(origin.requiredForActions || actions)]),
    requiredForHealth: origin.requiredForHealth ?? !optional,
    requiredForRefresh: origin.requiredForRefresh ?? !optional
  });
}
