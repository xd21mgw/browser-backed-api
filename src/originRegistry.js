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
      "rcp_policy_tree_lookup"
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
      "archives_related_users"
    ],
    refreshTtlMs: DEFAULT_REFRESH_TTL_MS,
    enabled: true,
    requiredForHealth: false,
    requiredForRefresh: false,
    optional: true
  }),
  track_analysis: freezeOrigin({
    name: "track_analysis",
    label: "Track Analysis",
    envVar: "TRACK_ANALYSIS_ORIGIN",
    warmupEnvVar: "TRACK_ANALYSIS_PREWARM_PATH",
    defaultOrigin: "https://track-analysis.corp.kuaishou.com",
    warmupPath: "/",
    actions: ["track_analysis_summary", "track_analysis_check_data_ready"],
    refreshTtlMs: DEFAULT_REFRESH_TTL_MS,
    enabled: true,
    requiredForHealth: true,
    requiredForRefresh: true,
    optional: false
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
