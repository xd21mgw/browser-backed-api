import { normalizeRelativePath } from "./config.js";
import { classifyHttpStatus } from "./diagnostics.js";

export const ACTION_ALLOWLIST = Object.freeze([
  "rcp_snapshot",
  "weapon_inventory",
  "login_logs_search",
  "track_analysis_summary",
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
  "archives_past_four_items",
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
  "rcp_node_bind_policy_attribution",
  "track_analysis_check_data_ready",
  "track_analysis_product_list",
  "track_sequence_dimension_list",
  "track_data_type_list"
]);

const ALLOWED_INPUT_KEYS = Object.freeze([
  "accountId",
  "workspaceId",
  "dateRange",
  "filters",
  "limit",
  "max_records",
  "currentPage",
  "keyword",
  "needFavorite",
  "cursor",
  "query",
  "severity",
  "recallSource",
  "featureKeys",
  "eventTypeCodes",
  "isPolicyTreeExperiment",
  "from_timestamp",
  "to_timestamp",
  "product",
  "productName",
  "searchLevel",
  "include_risk_data",
  "max_device_ids",
  "eventType",
  "source_id",
  "sourceIds",
  "startTime",
  "endTime",
  "page",
  "pageIndex",
  "pageSize",
  "begin",
  "end",
  "beginTime",
  "count",
  "matchType",
  "sort",
  "status",
  "direction",
  "photo_id",
  "info_type",
  "infoType",
  "markResult",
  "punishResult",
  "relation_type",
  "inputType",
  "type",
  "haveParamAuth",
  "operation_filters",
  "selected_columns",
  "user_id",
  "device_id",
  "appName",
  "include",
  "category",
  "event",
  "appPlatform",
  "metric",
  "time_window",
  "sub_interface",
  "mode",
  "response_mode",
  "eventId",
  "queryTime",
  "featureGroup",
  "policyCode",
  "policyVersion",
  "policyTreeCode",
  "policyTreeVersion",
  "policyTreeNodeCode",
  "targetPolicyCode",
  "statusCode",
  "size",
  "region"
]);

const RCP_EVENT_LIST_PATH = "/v2/rest/event/eventList";
const RCP_DEFAULT_EVENT_TYPE = "USER_REGISTER_NEW";
const RCP_DEFAULT_WINDOW_MS = 30 * 60 * 1000;
const RCP_DEFAULT_PAGE = 1;
const RCP_DEFAULT_PAGE_SIZE = 40;
const RCP_MAX_PAGE_SIZE = 500;
const RCP_DEFAULT_VERSION = "";
const RCP_DEFAULT_STATUS = 2;
const RCP_DEFAULT_SNAPSHOT_VERSION = "";
const RCP_DEFAULT_REAL_TIME_OP = "";
const RCP_DEFAULT_REGION = "china";
const RCP_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const RCP_DEFAULT_TABLE_COLUMNS = Object.freeze([
  "sourceId",
  "eventId",
  "_occurTime",
  "_realTimeOp",
  "_errorCode",
  "deviceId",
  "hitFusePolicyCode",
  "time"
]);
const RCP_COLUMN_COMMENTS = Object.freeze({
  sourceId: "sourceId",
  eventId: "eventId",
  _occurTime: "_occurTime",
  _realTimeOp: "_realTimeOp",
  _errorCode: "_errorCode",
  deviceId: "deviceId",
  hitFusePolicyCode: "hitFusePolicyCode",
  time: "time"
});

const WEAPON_GRAPH_DATA_PATH = "/apiv2/graphData";
const WEAPON_RISK_DATA_PATH = "/apiv2/riskData";
const WEAPON_DEFAULT_PRODUCT = "KUAISHOU";
const WEAPON_DEFAULT_PRODUCT_NAME = "KUAISHOU";
const WEAPON_DEFAULT_SEARCH_LEVEL = 2;
const WEAPON_DEFAULT_INCLUDE_RISK_DATA = true;
const WEAPON_DEFAULT_MAX_DEVICE_IDS = 5;
const WEAPON_MAX_DEVICE_IDS = 20;

const LOGIN_LOGS_SEARCH_PATH = "/rest/unified/log/search";
const LOGIN_LOGS_DEFAULT_RECALL_SOURCE = "2,0,1,3";
const LOGIN_LOGS_DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_LOGS_MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_LOGS_DEFAULT_LIMIT = 20;
const LOGIN_LOGS_MAX_LIMIT = 100;
const LOGIN_LOGS_DEFAULT_SERVICE_ROW_CAP = 300;
const LOGIN_LOGS_MAX_SERVICE_ROW_CAP = 300;
const LOGIN_LOGS_JSON_CAP_PATH = Object.freeze(["data", "logSearchModels"]);
const DEFAULT_RESPONSE_MODE = "passthrough";
const RESPONSE_MODES = Object.freeze(["passthrough"]);
const PASSTHROUGH_ONLY_RESPONSE_MODES = Object.freeze(["passthrough"]);

const TRACK_ANALYSIS_LATEST_DATE_PATH = "/dp/platform/app/analytics/v2/sequence/getLastestDateTime";
const TRACK_ANALYSIS_USE_DURATION_PATH = "/dp/platform/app/analytics/v2/sequence/getUseDuration";
const TRACK_ANALYSIS_PROFILE_PATH = "/dp/platform/app/analytics/v2/sequence/profile";
const TRACK_ANALYSIS_DEVICE_IDS_PATH = "/dp/platform/app/analytics/v2/sequence/getDeviceIds";
const TRACK_ANALYSIS_CHECK_DATA_READY_PATH = "/dp/platform/app/analytics/v2/sequence/checkDataReady";
const TRACK_ANALYSIS_PRODUCT_LIST_PATH = "/dp/track-analysis/product/list/v2";
const TRACK_SEQUENCE_DIMENSION_LIST_PATH = "/dp/platform/app/analytics/v2/sequence/dimension/list";
const TRACK_DATA_TYPE_LIST_PATH = "/dp/platform/app/analytics/v2/track/getDataTypeList";
const TRACK_ANALYSIS_APP_NAMES = Object.freeze(["KUAISHOU", "NEBULA"]);
const TRACK_ANALYSIS_SUB_INTERFACES = Object.freeze(["getLastestDateTime", "getUseDuration", "profile", "getDeviceIds"]);
const TRACK_ANALYSIS_FUNC_TYPE = "USER_PROFILE_QUERY";
const TRACK_ANALYSIS_DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const TRACK_ANALYSIS_DEFAULT_PRODUCT = "KUAISHOU";

const ARCHIVES_USER_ANALYSIS_PATH = "/v3/user/log/coreLogs/fetch";
const ARCHIVES_PHOTO_SEARCH_PATH = "/v4/archives/report/photo/search";
const ARCHIVES_PHOTO_PROFILE_PATH = "/v3/photo/profile";
const ARCHIVES_PHOTO_META_PATH = "/v3/photo/meta";
const ARCHIVES_PHOTO_REPORT_AGGREGATE_PATH = "/v3/photo/report/aggregate";
const ARCHIVES_PHOTO_USER_AUTONOMY_PATH = "/archives/photo/home/userAutonomy";
const ARCHIVES_GALLERY_PHOTO_LIST_PATH = "/v3/user/gallery/photo/list";
const ARCHIVES_USER_PROFILE_PATH = "/archives/user/home/info";
const ARCHIVES_RELATED_USERS_PATH = "/archives/user/search/device";
const ARCHIVES_PRIVATE_MESSAGE_SEARCH_PATH = "/archives/user/message/search";
const ARCHIVES_PAST_FOUR_ITEMS_PATH = "/v4/audit/user/fourinfo/log/search";
const ARCHIVES_MAX_PAGE_SIZE = 100;
const ARCHIVES_USER_ANALYSIS_FILTER_FIELDS = Object.freeze([
  "loginStart",
  "registerBind",
  "resetPass",
  "protectAccount",
  "liveStream",
  "scanCode",
  "logout",
  "frozen"
]);
const ARCHIVES_RELATED_USER_TYPES = Object.freeze({
  same_device_registered: 0,
  same_device_login: 1
});
const ARCHIVES_PRIVATE_MESSAGE_DIRECTIONS = Object.freeze({
  sent: "fromUserId",
  received: "toUserId"
});
const ARCHIVES_FOUR_INFO_TYPES = Object.freeze({
  all: 0,
  username: 1,
  avatar: 2,
  profile_description: 3,
  background: 4
});

const RCP_EVENT_DETAIL_PATH = "/v2/rest/event/rcpEventDetail";
const RCP_EVENT_FEATURE_LIST_PATH = "/v2/rest/event/rcpEventFeatureList";
const RCP_EVENT_TREE_OR_DECISION_PATH = "/v2/rest/event/rcpEventTreeOrDecision";
const RCP_FAST_QUERY_HBASE_PATH = "/v2/rest/event/fastQueryHbase";
const RCP_FEATURE_INFO_BY_KEYS_PATH = "/v2/rest/fc/getEventFeatureInfoByKeys";
const RCP_POLICY_BASIC_INFO_PATH = "/v2/rest/pc/policyReview/getPolicyBasicInfo";
const RCP_RELATION_POLICY_TREE_PATH = "/v2/rest/pc/policyReview/getRelationPolicyTree";
const RCP_POLICY_BINDING_INFO_LIST_PATH = "/v2/rest/pro/policy/policyBindingInfoList";
const RCP_POLICY_SEARCH_PATH = "/v2/rest/pro/policy/policySearch";
const RCP_POLICY_BLUR_SEARCH_PATH = "/v2/rest/pro/policy/policyBlurSearch";
const RCP_POLICY_ALL_VERSION_PATH = "/v2/rest/pro/policy/getPolicyAllVersion";
const RCP_PIPELINE_POLICY_VERSIONS_BY_CODE_PATH = "/v2/rest/common/pipeline/getPolicyVersionsByCode";
const RCP_POLICY_VERSION_LOOKUP_PATH = "/v2/rest/pc/policy/getPolicyVersionListByEvent";
const RCP_POLICY_DETAIL_LOOKUP_PATH = "/v2/rest/pro/policy/getPolicyDetailByVersion";
const RCP_POLICY_RELEASE_RECORD_PATH = "/v2/rest/common/pipeline/list";
const RCP_POLICY_TREE_LOOKUP_PATH = "/v2/rest/pro/policyTree/queryProPolicyTree";
const RCP_POLICY_TREE_LIST_PATH = "/v2/rest/pro/policyTree/policyTreeList";
const RCP_POLICY_TREE_BINDING_BY_NODE_PATH = "/v2/rest/pro/policyTree/queryBindingByNodeCode";
const RCP_POLICY_TREE_ALL_POLICY_CODE_PATH = "/v2/rest/pro/policyTree/getAllPolicyCodeByPage";
const RCP_NODE_POLICY_ATTRIBUTION_PATH = "/v2/rest/pc/policy/nodePolicyAttribution";
const RCP_NODE_BIND_POLICY_ATTRIBUTION_PATH = "/v2/rest/pc/policy/nodeBindPolicyAttribution";
const SAFE_CODE_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/;

const FORBIDDEN_INPUT_KEYS = Object.freeze([
  "url",
  "uri",
  "href",
  "origin",
  "host",
  "hostname",
  "protocol",
  "path",
  "pathname",
  "endpoint",
  "route",
  "headers",
  "header",
  "cookie",
  "cookies",
  "authorization",
  "auth",
  "token",
  "secret",
  "session",
  "sessionid",
  "rawquery",
  "rawbody",
  "csrf",
  "jwt"
]);
export const ACTIONS = Object.freeze({
  rcp_snapshot: freezeAction({
    name: "rcp_snapshot",
    domainKey: "rcp",
    description: "Return a compact RCP eventList shape summary for an allowed typed event query.",
    method: "POST",
    apiPath: RCP_EVENT_LIST_PATH,
    inputContract: {
      eventType: "optional string; default USER_REGISTER_NEW",
      source_id: "optional string; maps to eventV2.sourceIds",
      sourceIds: "optional string or string[]; maps to eventV2.sourceIds string",
      device_id: "optional string; maps to eventV2.conditionList",
      startTime: "optional YYYY-MM-DD HH:mm:ss",
      endTime: "optional YYYY-MM-DD HH:mm:ss",
      time_window: "optional { startTime, endTime } in YYYY-MM-DD HH:mm:ss",
      pageIndex: "optional positive integer; default 1",
      page: "optional positive integer alias for pageIndex",
      pageSize: "optional positive integer <= 500; default 40",
      selected_columns: "optional string[]; converted to tableHeaderList object array"
    },
    validateParams: validateRcpSnapshotInput,
    buildRequest: buildRcpSnapshotRequest,
    mockData: mockRcpSnapshotData
  }),
  weapon_inventory: freezeAction({
    name: "weapon_inventory",
    domainKey: "weapon",
    description: "Return a compact Weapon graphData and optional riskData shape summary for a typed entity.",
    method: "GET",
    apiPath: WEAPON_GRAPH_DATA_PATH,
    inputContract: {
      user_id: "required string when device_id is absent; graphData USER_ID -> DEVICE_ID",
      device_id: "required string when user_id is absent; graphData DEVICE_ID -> USER_ID",
      product: "optional enum; default KUAISHOU",
      productName: "optional enum; default KUAISHOU",
      searchLevel: "optional positive integer; default 2",
      include_risk_data: "optional boolean; default true",
      max_device_ids: "optional positive integer <= 20; default 5"
    },
    validateParams: validateWeaponInventoryInput,
    buildRequest: buildWeaponInventoryRequest,
    mockData: mockWeaponInventoryData
  }),
  login_logs_search: freezeAction({
    name: "login_logs_search",
    domainKey: "login_logs",
    description: "Return a bounded online login log shape summary for a typed user and time window.",
    method: "GET",
    apiPath: LOGIN_LOGS_SEARCH_PATH,
    expectedContentType: "json",
    inputContract: {
      user_id: "required string",
      time_window: "optional { from_timestamp, to_timestamp } epoch ms; default recent 7 days",
      from_timestamp: "optional epoch ms",
      to_timestamp: "optional epoch ms",
      recallSource: "optional string; default 2,0,1,3",
      limit: "optional positive integer <= 100; legacy service row target when max_records is absent",
      max_records: "optional service-side JSON row target <= 300; defaults to 300"
    },
    validateParams: validateLoginLogsInput,
    buildRequest: buildLoginLogsRequest,
    mockData: mockLoginLogsData
  }),
  track_analysis_summary: freezeAction({
    name: "track_analysis_summary",
    domainKey: "track_analysis",
    description: "Return a compact track-analysis shape and activity summary for a fixed track-analysis origin.",
    method: "GET",
    apiPath: TRACK_ANALYSIS_LATEST_DATE_PATH,
    inputContract: {
      user_id: "required string when device_id is absent",
      device_id: "required string when user_id is absent",
      appName: "required enum: KUAISHOU | NEBULA",
      sub_interface: "optional enum: getLastestDateTime | getUseDuration | profile | getDeviceIds; default getLastestDateTime",
      time_window: "optional { startTime, endTime }; profile defaults to the recent 30-day window"
    },
    validateParams: validateTrackAnalysisInput,
    buildRequest: buildTrackAnalysisRequest,
    mockData: (input) => ({
      sub_interface: trackAnalysisSubInterface(input),
      entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
      appName: input.appName,
      shape_summary_only: true,
      latest_datetime_present: trackAnalysisSubInterface(input) === "getLastestDateTime",
      uid_did_relation_latest_datetime_present: trackAnalysisSubInterface(input) === "getLastestDateTime",
      activity_summary: mockTrackAnalysisActivitySummary(input),
      profile_summary: mockTrackAnalysisProfileSummary(input),
      device_summary: mockTrackAnalysisDeviceSummary(input),
      generated_at: fixedMockTime()
    })
  }),
  archives_user_analysis: freezeAction({
    name: "archives_user_analysis",
    domainKey: "archives",
    description: "Return a compact Archives Center user action timeline shape summary for typed user/time params.",
    method: "POST",
    apiPath: ARCHIVES_USER_ANALYSIS_PATH,
    registryStatus: "service_registered",
    inputContract: {
      user_id: "required decimal string",
      beginTime: "required epoch ms",
      endTime: "required epoch ms",
      pageIndex: "optional positive integer; default 1",
      pageSize: "optional positive integer <= 100; default 30"
    },
    validateParams: validateArchivesUserAnalysisInput,
    buildRequest: buildArchivesUserAnalysisRequest,
    mockData: mockArchivesUserAnalysisData
  }),
  archives_user_profile: freezeAction({
    name: "archives_user_profile",
    domainKey: "archives",
    description: "Return a compact Archives Center user profile shape summary for a typed user.",
    method: "GET",
    apiPath: ARCHIVES_USER_PROFILE_PATH,
    registryStatus: "service_registered",
    inputContract: {
      user_id: "required decimal string"
    },
    validateParams: validateArchivesUserProfileInput,
    buildRequest: buildArchivesUserProfileRequest,
    mockData: mockArchivesUserProfileData
  }),
  archives_photo_search: freezeAction({
    name: "archives_photo_search",
    domainKey: "archives",
    description: "Return a compact Archives Center photo report/search shape summary for typed user/time params.",
    method: "POST",
    apiPath: ARCHIVES_PHOTO_SEARCH_PATH,
    registryStatus: "service_registered",
    inputContract: {
      user_id: "required decimal string; maps to reportedIds",
      begin: "required epoch ms",
      end: "required epoch ms",
      page: "optional positive integer; default 1",
      count: "optional positive integer <= 100; default 20",
      matchType: "optional enum string 0|1|2; default 0",
      sort: "optional enum string 0|1; default 0"
    },
    validateParams: validateArchivesPhotoSearchInput,
    buildRequest: buildArchivesPhotoSearchRequest,
    mockData: mockArchivesPhotoSearchData
  }),
  archives_photo_profile: freezeAction({
    name: "archives_photo_profile",
    domainKey: "archives",
    description: "Passthrough Archives Center photo profile for a typed photo id.",
    method: "POST",
    apiPath: ARCHIVES_PHOTO_PROFILE_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      photo_id: "required decimal string; maps to photoId"
    },
    validateParams: validateArchivesPhotoIdInput("archives_photo_profile"),
    buildRequest: buildArchivesPhotoIdRequest(ARCHIVES_PHOTO_PROFILE_PATH),
    mockData: mockArchivesPhotoProfileData
  }),
  archives_photo_meta: freezeAction({
    name: "archives_photo_meta",
    domainKey: "archives",
    description: "Passthrough Archives Center photo metadata for a typed photo id.",
    method: "POST",
    apiPath: ARCHIVES_PHOTO_META_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      photo_id: "required decimal string; maps to photoId"
    },
    validateParams: validateArchivesPhotoIdInput("archives_photo_meta"),
    buildRequest: buildArchivesPhotoIdRequest(ARCHIVES_PHOTO_META_PATH),
    mockData: mockArchivesPhotoMetaData
  }),
  archives_photo_report_aggregate: freezeAction({
    name: "archives_photo_report_aggregate",
    domainKey: "archives",
    description: "Passthrough Archives Center photo report aggregate for a typed photo id.",
    method: "POST",
    apiPath: ARCHIVES_PHOTO_REPORT_AGGREGATE_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      photo_id: "required decimal string; maps to photoId"
    },
    validateParams: validateArchivesPhotoIdInput("archives_photo_report_aggregate"),
    buildRequest: buildArchivesPhotoIdRequest(ARCHIVES_PHOTO_REPORT_AGGREGATE_PATH),
    mockData: mockArchivesPhotoReportAggregateData
  }),
  archives_photo_user_autonomy: freezeAction({
    name: "archives_photo_user_autonomy",
    domainKey: "archives",
    description: "Passthrough Archives Center photo autonomy status for a typed photo id.",
    method: "POST",
    apiPath: ARCHIVES_PHOTO_USER_AUTONOMY_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      photo_id: "required decimal string; maps to photoId"
    },
    validateParams: validateArchivesPhotoIdInput("archives_photo_user_autonomy"),
    buildRequest: buildArchivesPhotoIdRequest(ARCHIVES_PHOTO_USER_AUTONOMY_PATH),
    mockData: mockArchivesPhotoUserAutonomyData
  }),
  archives_gallery_photo_list: freezeAction({
    name: "archives_gallery_photo_list",
    domainKey: "archives",
    description: "Passthrough Archives Center user gallery photo list for typed user and bounded page params.",
    method: "POST",
    apiPath: ARCHIVES_GALLERY_PHOTO_LIST_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      user_id: "required decimal string; maps to userId",
      pageIndex: "optional positive integer; default 1",
      pageSize: "optional positive integer <= 100; default 20"
    },
    validateParams: validateArchivesGalleryPhotoListInput,
    buildRequest: buildArchivesGalleryPhotoListRequest,
    mockData: mockArchivesGalleryPhotoListData
  }),
  archives_related_users: freezeAction({
    name: "archives_related_users",
    domainKey: "archives",
    description: "Return a compact Archives Center related-users shape summary for typed same-device relation params.",
    method: "POST",
    apiPath: ARCHIVES_RELATED_USERS_PATH,
    registryStatus: "service_registered",
    inputContract: {
      user_id: "required decimal string; maps to keyword",
      relation_type: "optional enum same_device_registered|same_device_login; default same_device_registered"
    },
    validateParams: validateArchivesRelatedUsersInput,
    buildRequest: buildArchivesRelatedUsersRequest,
    mockData: mockArchivesRelatedUsersData
  }),
  archives_private_message_search: freezeAction({
    name: "archives_private_message_search",
    domainKey: "archives",
    description: "Passthrough Archives Center private-message search for typed user direction and bounded page params.",
    method: "POST",
    apiPath: ARCHIVES_PRIVATE_MESSAGE_SEARCH_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      user_id: "required decimal string",
      direction: "required enum sent|received; maps to fromUserId or toUserId",
      page: "optional positive integer; default 1",
      count: "optional positive integer <= 100; default 20",
      status: "optional safe short string; default empty",
      sort: "optional enum string 0|1; default 0"
    },
    validateParams: validateArchivesPrivateMessageSearchInput,
    buildRequest: buildArchivesPrivateMessageSearchRequest,
    mockData: mockArchivesPrivateMessageSearchData
  }),
  archives_past_four_items: freezeAction({
    name: "archives_past_four_items",
    domainKey: "archives",
    description: "Passthrough Archives Center four-info change-log search for typed user and info type params.",
    method: "POST",
    apiPath: ARCHIVES_PAST_FOUR_ITEMS_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      user_id: "required decimal string; maps to keyword",
      info_type: "optional enum all|username|avatar|profile_description|background; default all",
      infoType: "optional enum 0|1|2|3|4; must match info_type when both are provided",
      page: "optional positive integer; default 1",
      count: "optional positive integer <= 100; default 20",
      markResult: "optional safe short string; default empty",
      punishResult: "optional safe short string; default empty"
    },
    validateParams: validateArchivesPastFourItemsInput,
    buildRequest: buildArchivesPastFourItemsRequest,
    mockData: mockArchivesPastFourItemsData
  }),
  rcp_event_detail: freezeAction({
    name: "rcp_event_detail",
    domainKey: "rcp",
    description: "Return a compact RCP event detail shape summary for a typed event id and exact query time.",
    method: "GET",
    apiPath: RCP_EVENT_DETAIL_PATH,
    registryStatus: "service_registered",
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      queryTime: "required exact event time epoch ms"
    },
    validateParams: validateRcpEventIdentityInput,
    buildRequest: buildRcpEventDetailRequest,
    mockData: mockRcpEventDetailData
  }),
  rcp_event_feature_list: freezeAction({
    name: "rcp_event_feature_list",
    domainKey: "rcp",
    description: "Return a compact RCP feature snapshot shape summary for a typed event id and exact query time.",
    method: "GET",
    apiPath: RCP_EVENT_FEATURE_LIST_PATH,
    registryStatus: "service_registered",
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      queryTime: "required exact event time epoch ms",
      featureGroup: "optional empty string only"
    },
    validateParams: validateRcpEventFeatureListInput,
    buildRequest: buildRcpEventFeatureListRequest,
    mockData: mockRcpEventFeatureListData
  }),
  rcp_event_tree_or_decision: freezeAction({
    name: "rcp_event_tree_or_decision",
    domainKey: "rcp",
    description: "Passthrough RCP event tree/decision lookup for typed event identity params.",
    method: "GET",
    apiPath: RCP_EVENT_TREE_OR_DECISION_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      queryTime: "required exact event time epoch ms",
      region: "optional enum china|oversea|empty; default china",
      isPolicyTreeExperiment: "optional false only; fixed HAR query value"
    },
    validateParams: validateRcpEventTreeOrDecisionInput,
    buildRequest: buildRcpEventTreeOrDecisionRequest,
    mockData: mockRcpEventTreeOrDecisionData
  }),
  rcp_fast_query_hbase: freezeAction({
    name: "rcp_fast_query_hbase",
    domainKey: "rcp",
    description: "Passthrough RCP fast HBase event lookup for typed source/time params.",
    method: "GET",
    apiPath: RCP_FAST_QUERY_HBASE_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      source_id: "required when sourceIds is absent; maps to sourceIds",
      sourceIds: "required when source_id is absent; string or string[]",
      startTime: "required epoch ms",
      endTime: "required epoch ms",
      eventTypeCodes: "optional comma-separated safe event type list; default empty",
      limit: "optional positive integer <= 500; default 500"
    },
    validateParams: validateRcpFastQueryHbaseInput,
    buildRequest: buildRcpFastQueryHbaseRequest,
    mockData: mockRcpFastQueryHbaseData
  }),
  rcp_feature_info_by_keys: freezeAction({
    name: "rcp_feature_info_by_keys",
    domainKey: "rcp",
    description: "Passthrough RCP feature info lookup for typed event identity and feature keys.",
    method: "GET",
    apiPath: RCP_FEATURE_INFO_BY_KEYS_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      queryTime: "required exact event time epoch ms",
      featureKeys: "required safe feature key string or string[]",
      region: "optional enum china|oversea|empty; default china"
    },
    validateParams: validateRcpFeatureInfoByKeysInput,
    buildRequest: buildRcpFeatureInfoByKeysRequest,
    mockData: mockRcpFeatureInfoByKeysData
  }),
  rcp_policy_basic_info: freezeAction({
    name: "rcp_policy_basic_info",
    domainKey: "rcp",
    description: "Passthrough RCP policy basic info lookup for typed policy and policy tree code.",
    method: "GET",
    apiPath: RCP_POLICY_BASIC_INFO_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "required safe policy code",
      policyTreeCode: "required safe policy tree code"
    },
    validateParams: validateRcpPolicyBasicInfoInput,
    buildRequest: buildRcpPolicyBasicInfoRequest,
    mockData: mockRcpPolicyBasicInfoData
  }),
  rcp_relation_policy_tree: freezeAction({
    name: "rcp_relation_policy_tree",
    domainKey: "rcp",
    description: "Passthrough RCP relation policy tree lookup for a typed policy code.",
    method: "GET",
    apiPath: RCP_RELATION_POLICY_TREE_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "required safe policy code"
    },
    validateParams: validateRcpPolicyCodeOnlyInput("rcp_relation_policy_tree"),
    buildRequest: buildRcpPolicyCodeOnlyGetRequest(RCP_RELATION_POLICY_TREE_PATH),
    mockData: mockRcpRelationPolicyTreeData
  }),
  rcp_policy_binding_info_list: freezeAction({
    name: "rcp_policy_binding_info_list",
    domainKey: "rcp",
    description: "Passthrough RCP policy binding info list for typed policy code/version and bounded page params.",
    method: "GET",
    apiPath: RCP_POLICY_BINDING_INFO_LIST_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "required safe policy code",
      policyVersion: "required positive integer",
      page: "optional positive integer; default 1",
      size: "optional positive integer <= 100; default 20"
    },
    validateParams: validateRcpPolicyBindingInfoListInput,
    buildRequest: buildRcpPolicyBindingInfoListRequest,
    mockData: mockRcpPolicyBindingInfoListData
  }),
  rcp_policy_search: freezeAction({
    name: "rcp_policy_search",
    domainKey: "rcp",
    description: "Passthrough RCP policy search using a fixed service-owned body and typed filters.",
    method: "POST",
    apiPath: RCP_POLICY_SEARCH_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "optional safe policy code",
      policyTreeCode: "optional safe policy tree code",
      page: "optional positive integer; default 1",
      size: "optional positive integer <= 100; default 20"
    },
    validateParams: validateRcpPolicySearchInput,
    buildRequest: buildRcpPolicySearchRequest,
    mockData: mockRcpPolicySearchData
  }),
  rcp_policy_blur_search: freezeAction({
    name: "rcp_policy_blur_search",
    domainKey: "rcp",
    description: "Passthrough RCP policy blur search for typed policy filters and bounded page params.",
    method: "GET",
    apiPath: RCP_POLICY_BLUR_SEARCH_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "optional safe policy code",
      policyTreeCode: "optional safe policy tree code",
      page: "optional positive integer; default 1",
      size: "optional positive integer <= 100; default 20"
    },
    validateParams: validateRcpPolicySearchInput,
    buildRequest: buildRcpPolicyBlurSearchRequest,
    mockData: mockRcpPolicyBlurSearchData
  }),
  rcp_policy_all_version: freezeAction({
    name: "rcp_policy_all_version",
    domainKey: "rcp",
    description: "Passthrough RCP all-version policy lookup for a typed policy code.",
    method: "GET",
    apiPath: RCP_POLICY_ALL_VERSION_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "required safe policy code",
      page: "optional positive integer; default 1",
      size: "optional positive integer <= 100; default 50"
    },
    validateParams: validateRcpPolicyAllVersionInput,
    buildRequest: buildRcpPolicyAllVersionRequest,
    mockData: mockRcpPolicyAllVersionData
  }),
  rcp_pipeline_policy_versions_by_code: freezeAction({
    name: "rcp_pipeline_policy_versions_by_code",
    domainKey: "rcp",
    description: "Passthrough RCP pipeline policy versions lookup for a typed policy code.",
    method: "GET",
    apiPath: RCP_PIPELINE_POLICY_VERSIONS_BY_CODE_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "required safe policy code"
    },
    validateParams: validateRcpPolicyCodeOnlyInput("rcp_pipeline_policy_versions_by_code"),
    buildRequest: buildRcpPolicyCodeOnlyGetRequest(RCP_PIPELINE_POLICY_VERSIONS_BY_CODE_PATH),
    mockData: mockRcpPipelinePolicyVersionsByCodeData
  }),
  rcp_policy_version_lookup: freezeAction({
    name: "rcp_policy_version_lookup",
    domainKey: "rcp",
    description: "Passthrough RCP policy version lookup for typed event and policy identity params.",
    method: "GET",
    apiPath: RCP_POLICY_VERSION_LOOKUP_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      policyCode: "required safe policy code",
      policyVersion: "required positive integer",
      queryTime: "required exact event time epoch ms"
    },
    validateParams: validateRcpPolicyVersionLookupInput,
    buildRequest: buildRcpPolicyVersionLookupRequest,
    mockData: mockRcpPolicyVersionLookupData
  }),
  rcp_policy_detail_lookup: freezeAction({
    name: "rcp_policy_detail_lookup",
    domainKey: "rcp",
    description: "Passthrough RCP policy detail lookup for typed policy code and version.",
    method: "GET",
    apiPath: RCP_POLICY_DETAIL_LOOKUP_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "required safe policy code",
      policyVersion: "required positive integer"
    },
    validateParams: validateRcpPolicyDetailLookupInput,
    buildRequest: buildRcpPolicyDetailLookupRequest,
    mockData: mockRcpPolicyDetailLookupData
  }),
  rcp_policy_release_record_lookup: freezeAction({
    name: "rcp_policy_release_record_lookup",
    domainKey: "rcp",
    description: "Passthrough RCP policy release-record lookup with a fixed pipeline list body.",
    method: "POST",
    apiPath: RCP_POLICY_RELEASE_RECORD_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      policyCode: "required safe policy code; maps to extrbB",
      statusCode: "optional safe workflow status code; default empty",
      page: "optional positive integer; default 1",
      size: "optional positive integer <= 100; default 20"
    },
    validateParams: validateRcpPolicyReleaseRecordLookupInput,
    buildRequest: buildRcpPolicyReleaseRecordLookupRequest,
    mockData: mockRcpPolicyReleaseRecordLookupData
  }),
  rcp_policy_tree_lookup: freezeAction({
    name: "rcp_policy_tree_lookup",
    domainKey: "rcp",
    description: "Return a compact RCP policy-tree asset lookup shape summary; strategy governance only.",
    method: "GET",
    apiPath: RCP_POLICY_TREE_LOOKUP_PATH,
    registryStatus: "service_registered",
    inputContract: {
      policyTreeCode: "required safe policy tree code",
      policyTreeVersion: "required positive integer; HAR-derived query key policyTreeVersion",
      targetPolicyCode: "optional safe policy code; included in the HAR-derived query when provided"
    },
    validateParams: validateRcpPolicyTreeLookupInput,
    buildRequest: buildRcpPolicyTreeLookupRequest,
    mockData: mockRcpPolicyTreeLookupData
  }),
  rcp_node_policy_attribution: freezeAction({
    name: "rcp_node_policy_attribution",
    domainKey: "rcp",
    description: "Passthrough RCP node policy attribution for typed event and policy identity params.",
    method: "POST",
    apiPath: RCP_NODE_POLICY_ATTRIBUTION_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      policyCode: "required safe policy code",
      policyVersion: "required positive integer",
      queryTime: "required exact event time epoch ms",
      region: "optional enum china|oversea|empty; default china",
      type: "optional fixed empty string"
    },
    validateParams: validateRcpNodePolicyAttributionInput,
    buildRequest: buildRcpNodePolicyAttributionRequest,
    mockData: mockRcpNodePolicyAttributionData
  }),
  rcp_node_bind_policy_attribution: freezeAction({
    name: "rcp_node_bind_policy_attribution",
    domainKey: "rcp",
    description: "Passthrough RCP node-binding policy attribution for typed event and resolved policy-tree node params.",
    method: "GET",
    apiPath: RCP_NODE_BIND_POLICY_ATTRIBUTION_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      queryTime: "required exact event time epoch ms",
      policyTreeCode: "required safe policy tree code",
      policyTreeVersion: "required positive integer",
      policyTreeNodeCode: "required safe resolved policy tree node code"
    },
    validateParams: validateRcpNodeBindPolicyAttributionInput,
    buildRequest: buildRcpNodeBindPolicyAttributionRequest,
    mockData: mockRcpNodeBindPolicyAttributionData
  }),
  track_analysis_check_data_ready: freezeAction({
    name: "track_analysis_check_data_ready",
    domainKey: "track_analysis",
    description: "Return a compact Track Analysis readiness shape summary for typed device/time params.",
    method: "POST",
    apiPath: TRACK_ANALYSIS_CHECK_DATA_READY_PATH,
    registryStatus: "service_registered",
    inputContract: {
      device_id: "required string; maps to deviceId",
      appName: "required enum KUAISHOU|NEBULA",
      product: "optional enum KUAISHOU|NEBULA; default KUAISHOU",
      startTime: "required epoch ms",
      endTime: "required epoch ms",
      category: "optional safe string[]",
      event: "optional safe string[]",
      appPlatform: "optional safe string[]",
      metric: "optional safe label; default pv",
      type: "optional fixed enum deviceId"
    },
    validateParams: validateTrackAnalysisCheckDataReadyInput,
    buildRequest: buildTrackAnalysisCheckDataReadyRequest,
    mockData: mockTrackAnalysisCheckDataReadyData
  }),
  track_analysis_product_list: freezeAction({
    name: "track_analysis_product_list",
    domainKey: "track_analysis",
    description: "Passthrough Track Analysis product list for typed product/app and bounded page params.",
    method: "POST",
    apiPath: TRACK_ANALYSIS_PRODUCT_LIST_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      appName: "optional enum KUAISHOU|NEBULA; default KUAISHOU",
      product: "optional enum KUAISHOU|NEBULA; default KUAISHOU",
      currentPage: "optional positive integer; default 1",
      pageSize: "optional positive integer <= 100; default 20",
      keyword: "optional safe string <= 128 chars",
      type: "optional positive integer; default 1",
      needFavorite: "optional boolean; default true"
    },
    validateParams: validateTrackAnalysisProductListInput,
    buildRequest: buildTrackAnalysisProductListRequest,
    mockData: mockTrackAnalysisProductListData
  }),
  track_sequence_dimension_list: freezeAction({
    name: "track_sequence_dimension_list",
    domainKey: "track_analysis",
    description: "Passthrough Track Analysis sequence dimension list for typed product params.",
    method: "GET",
    apiPath: TRACK_SEQUENCE_DIMENSION_LIST_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      product: "optional enum KUAISHOU|NEBULA; default KUAISHOU"
    },
    validateParams: validateTrackProductOnlyInput("track_sequence_dimension_list"),
    buildRequest: buildTrackProductOnlyGetRequest(TRACK_SEQUENCE_DIMENSION_LIST_PATH),
    mockData: mockTrackSequenceDimensionListData
  }),
  track_data_type_list: freezeAction({
    name: "track_data_type_list",
    domainKey: "track_analysis",
    description: "Passthrough Track Analysis data type list for typed product params.",
    method: "GET",
    apiPath: TRACK_DATA_TYPE_LIST_PATH,
    registryStatus: "service_registered",
    defaultResponseMode: "passthrough",
    responseModes: PASSTHROUGH_ONLY_RESPONSE_MODES,
    passthroughOnly: true,
    inputContract: {
      product: "optional enum KUAISHOU|NEBULA; default KUAISHOU"
    },
    validateParams: validateTrackProductOnlyInput("track_data_type_list"),
    buildRequest: buildTrackProductOnlyGetRequest(TRACK_DATA_TYPE_LIST_PATH),
    mockData: mockTrackDataTypeListData
  })
});

assertAllowlistMatchesRegistry();

export function listActions(config) {
  return Object.values(ACTIONS).map((action) => {
    const domain = config.domains[action.domainKey];
    const responseModes = actionResponseModes(action);
    const defaultResponseMode = actionDefaultResponseMode(action);
    return {
      name: action.name,
      description: action.description,
      domain: domain.label,
      method: action.method,
      registry_status: action.registryStatus || "service_registered",
      platform_enabled: domain.enabled !== false,
      default_response_mode: defaultResponseMode,
      response_modes: responseModes,
      default_runtime_routing: false,
      live_verified: false,
      input_contract: {
        ...action.inputContract,
        response_mode: responseModeContractText(responseModes, defaultResponseMode)
      },
      response_policy: {
        upstream_business_body_returned: "bounded",
        upstream_body_suppressed: false,
        transport_status_only: false,
        reads_cookie_token_session_header_plaintext: false
      }
    };
  });
}

export function getAction(name) {
  return ACTIONS[name] || null;
}

export function buildActionBody(action, input) {
  validateActionInput(input);
  const safeInput = sanitizeInput(input);
  const parameterError = getActionParameterError(action, safeInput);
  if (parameterError) {
    const error = new Error(parameterError.message);
    error.code = "parameter_error";
    error.parameterError = parameterError;
    throw error;
  }
  if (typeof action.buildRequest === "function") {
    const request = action.buildRequest(safeInput);
    return {
      ...request,
      path: normalizeRelativePath(request.path, `${action.name}.requestPath`),
      method: request.method || action.method,
      body: request.body || {},
      displayPath: request.displayPath
        ? normalizeRelativePath(request.displayPath, `${action.name}.displayPath`)
        : undefined
    };
  }
  return {
    path: action.apiPath,
    method: action.method,
    body: safeInput
  };
}

export function runMockAction(action, input, config, meta = {}) {
  validateActionInput(input);
  const safeInput = sanitizeInput(input);
  const parameterError = getActionParameterError(action, safeInput);
  if (parameterError) {
    return buildPassthroughFailureResponse(action, safeInput, {
      ...meta,
      errorType: parameterError.errorType || "parameter_error",
      invalidParams: true,
      parameterError
    });
  }
  const data = action.mockData(safeInput);
  const fetchMeta = {
    ok: true,
    status: 200,
    bodyTruncated: false,
    observedBytes: JSON.stringify(data).length,
    contentType: "application/json",
    bodyText: JSON.stringify(data)
  };

  return buildPassthroughActionResponse(action, safeInput, fetchMeta, {
    ...meta,
    fetchedAt: new Date().toISOString()
  });
}

export function buildLiveActionResponse(action, input, config, fetchResult, meta = {}) {
  return buildPassthroughActionResponse(action, input, fetchResult, meta);
}

export function buildPassthroughActionResponse(action, input, fetchResult, meta = {}) {
  validateActionInput(input);
  const fetchedAt = meta.fetchedAt || new Date().toISOString();
  const contentType = contentTypeFromFetchResult(fetchResult);
  const bodyText = typeof fetchResult?.bodyText === "string" ? fetchResult.bodyText : "";
  const bodyPresent = bodyText.length > 0;
  const observedBytes = typeof fetchResult?.observedBytes === "number"
    ? fetchResult.observedBytes
    : Buffer.byteLength(bodyText, "utf8");
  const httpStatus = typeof fetchResult?.status === "number" ? fetchResult.status : null;
  const bodyTruncated = Boolean(fetchResult?.bodyTruncated);
  const jsonArrayCap = normalizeJsonArrayCap(fetchResult?.jsonArrayCap);
  const rawBodyHandling = bodyPresent
    ? jsonArrayCap?.ok && bodyTruncated
      ? "json_array_capped"
      : bodyTruncated
        ? "capped"
        : "visible"
    : "omitted";
  const returnedBody = buildReturnedUpstreamBody(bodyText, contentType, {
    truncated: bodyTruncated && !jsonArrayCap?.ok
  });
  const upstream = {
    status: httpStatus,
    content_type: contentType,
    body_present: bodyPresent,
    body_omitted: false,
    body_truncated: bodyTruncated,
    response_too_large: bodyTruncated,
    observed_bytes: observedBytes,
    returned_bytes: typeof fetchResult?.returnedBytes === "number" ? fetchResult.returnedBytes : returnedBody.returnedBytes,
    raw_body_handling: rawBodyHandling
  };
  let ok = Boolean(fetchResult?.ok);
  let errorType = classifyHttpStatus(httpStatus) || null;
  let platformError = errorType;
  let transportError = null;
  const unexpectedHtml = detectUnexpectedHtmlApiResponse(action, contentType, bodyText);

  if (unexpectedHtml) {
    ok = false;
    errorType = "unexpected_html_response";
    platformError = "api_contract_mismatch";
    upstream.body_omitted = true;
    upstream.response_too_large = false;
    upstream.error_type = errorType;
    upstream.raw_body_handling = "omitted";
    upstream.expected_content_type = "application/json";
    upstream.api_contract_mismatch = true;
    upstream.response_body_kind = "html_page";
  } else if (bodyPresent && bodyTruncated && jsonArrayCap?.ok) {
    ok = false;
    errorType = "response_too_large";
    platformError = null;
    upstream.response_too_large = true;
    upstream.error_type = errorType;
    upstream.raw_body_handling = "json_array_capped";
    upstream.capped_json_path = jsonArrayCap.path;
    upstream.observed_records = jsonArrayCap.observedRecords;
    upstream.returned_records = jsonArrayCap.returnedRecords;
    upstream.missing_records = jsonArrayCap.missingRecords;
    upstream.missing_body_reason = "response_too_large";
    upstream.cap_reason = jsonArrayCap.capReason || "response_too_large";
    upstream.capped_body = returnedBody.body;
  } else if (bodyPresent && bodyTruncated) {
    ok = false;
    errorType = "response_too_large";
    platformError = null;
    upstream.response_too_large = true;
    upstream.error_type = errorType;
    upstream.body_snippet = returnedBody.body;
    if (jsonArrayCap?.attempted && !jsonArrayCap.ok) {
      upstream.json_array_cap_error_type = jsonArrayCap.errorType || "json_parse_error";
      upstream.capped_json_path = jsonArrayCap.path || null;
    }
  } else if (bodyPresent) {
    upstream.body = returnedBody.body;
  } else {
    upstream.body_omitted = true;
  }

  if (!ok && !errorType) {
    errorType = "upstream_not_ok";
    platformError = platformError || errorType;
  }

  return {
    ok,
    action: action.name,
    action_name: action.name,
    request_id: meta.requestId || localRequestId(),
    request_mode: "fixed_action",
    response_mode: "passthrough",
    platform: action.domainKey,
    http_status: upstream.status,
    content_type: upstream.content_type,
    body_present: upstream.body_present,
    body_truncated: upstream.body_truncated,
    observed_bytes: upstream.observed_bytes,
    elapsed_ms: meta.latencyMs ?? null,
    transport_error: transportError,
    platform_error: platformError,
    invalid_params: false,
    timeout: false,
    auth_redirect_detected: Boolean(meta.authRedirectDetected),
    raw_body_handling: upstream.raw_body_handling,
    cap_reason: upstream.cap_reason || null,
    upstream,
    ...(errorType ? { error_type: errorType } : {}),
    meta: {
      origin: action.domainKey,
      latency_ms: meta.latencyMs ?? null,
      fetched_at: fetchedAt
    },
    safety: passthroughSafety({ upstreamBusinessBodyVisible: bodyPresent && !upstream.body_omitted })
  };
}

export function buildPassthroughFailureResponse(action, input, meta = {}) {
  validateActionInput(input);
  const errorType = meta.errorType || "fetch_failed";
  const httpStatus = typeof meta.httpStatus === "number" ? meta.httpStatus : null;
  const invalidParams = Boolean(meta.invalidParams || /parameter/i.test(errorType));
  const timedOut = Boolean(meta.timedOut || /timeout/i.test(errorType));
  return {
    ok: false,
    action: action.name,
    action_name: action.name,
    request_id: meta.requestId || localRequestId(),
    request_mode: "fixed_action",
    response_mode: "passthrough",
    platform: action.domainKey,
    error_type: errorType,
    http_status: httpStatus,
    content_type: null,
    body_present: false,
    body_truncated: false,
    observed_bytes: 0,
    elapsed_ms: meta.latencyMs ?? null,
    transport_error: timedOut ? "timeout" : meta.transportError || null,
    platform_error: meta.platformError || null,
    invalid_params: invalidParams,
    timeout: timedOut,
    auth_redirect_detected: Boolean(meta.authRedirectDetected),
    raw_body_handling: "omitted",
    upstream: {
      status: httpStatus,
      content_type: null,
      body_present: false,
      body_omitted: true,
      body_truncated: false,
      response_too_large: false,
      observed_bytes: 0,
      returned_bytes: 0,
      raw_body_handling: "omitted",
      error_type: errorType
    },
    ...(meta.parameterError
      ? {
          parameter_error: {
            message: meta.parameterError.message || "Missing or invalid action parameters",
            required: meta.parameterError.required || []
          }
        }
      : {}),
    meta: {
      origin: action.domainKey,
      latency_ms: meta.latencyMs ?? null,
      fetched_at: meta.fetchedAt || new Date().toISOString()
    },
    safety: passthroughSafety({ upstreamBusinessBodyVisible: false })
  };
}

export function buildLiveActionFailureResponse(action, input, config, meta = {}) {
  return buildPassthroughFailureResponse(action, input, meta);
}

export function buildActionParameterErrorResponse(action, config, meta = {}) {
  return buildPassthroughFailureResponse(action, {}, {
    ...meta,
    errorType: meta.parameterError?.errorType || "parameter_error",
    invalidParams: true
  });
}

export function buildActionDisabledByPlatformScopeResponse(action, config, meta = {}) {
  return buildPassthroughFailureResponse(action, {}, {
    ...meta,
    errorType: "platform_not_enabled",
    platformError: "platform_not_enabled"
  });
}

export function validateActionInput(input) {
  if (!input || typeof input !== "object") {
    return;
  }

  const violation = findForbiddenInput(input);
  if (violation) {
    const error = new Error(`Forbidden action input: ${violation}`);
    error.statusCode = 400;
    error.code = "forbidden_action_input";
    error.publicMessage = "Action input may not include URLs, paths, headers, cookies, tokens, sessions, secrets, or raw bodies";
    throw error;
  }
}

export function getActionParameterError(action, input) {
  const responseModes = actionResponseModes(action);
  if (input && Object.hasOwn(input, "response_mode") && !responseModes.includes(input.response_mode)) {
    return {
      message: `response_mode must be ${responseModes.join(" or ")}`,
      required: [`response_mode=${responseModes.join("|")}`],
      errorType: "invalid_parameter"
    };
  }
  if (typeof action.validateParams !== "function") {
    return null;
  }
  return action.validateParams(input || {});
}

function validateArchivesUserAnalysisInput(input) {
  const userError = validateDecimalUserId("archives_user_analysis", input);
  if (userError) {
    return userError;
  }
  const windowError = validatePositiveTimeRange("archives_user_analysis", input, "beginTime", "endTime");
  if (windowError) {
    return windowError;
  }
  const pageError = validatePageControls("archives_user_analysis", input, ARCHIVES_MAX_PAGE_SIZE, 30);
  if (pageError) {
    return pageError;
  }
  return null;
}

function buildArchivesUserAnalysisRequest(input) {
  const pageIndex = positiveIntegerParam(input, "pageIndex", 1);
  const pageSize = positiveIntegerParam(input, "pageSize", 30);
  const body = {
    userId: input.user_id.trim(),
    beginTime: input.beginTime,
    endTime: input.endTime,
    pageIndex,
    pageSize,
    haveParamAuth: 1
  };
  for (const field of ARCHIVES_USER_ANALYSIS_FILTER_FIELDS) {
    body[field] = 1;
  }
  return {
    path: ARCHIVES_USER_ANALYSIS_PATH,
    displayPath: ARCHIVES_USER_ANALYSIS_PATH,
    method: "POST",
    body
  };
}

function validateArchivesUserProfileInput(input) {
  return validateDecimalUserId("archives_user_profile", input);
}

function buildArchivesUserProfileRequest(input) {
  const params = new URLSearchParams({ userId: input.user_id.trim() });
  const displayParams = new URLSearchParams({ userId: "[typed_user_id]" });
  return {
    path: `${ARCHIVES_USER_PROFILE_PATH}?${params.toString()}`,
    displayPath: `${ARCHIVES_USER_PROFILE_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateArchivesPhotoSearchInput(input) {
  const userError = validateDecimalUserId("archives_photo_search", input);
  if (userError) {
    return userError;
  }
  const windowError = validatePositiveTimeRange("archives_photo_search", input, "begin", "end");
  if (windowError) {
    return windowError;
  }
  const pageError = validatePageControls("archives_photo_search", input, 100, 20, "page", "count");
  if (pageError) {
    return pageError;
  }
  if (Object.hasOwn(input, "matchType") && !["0", "1", "2"].includes(String(input.matchType))) {
    return {
      message: "archives_photo_search matchType must be 0, 1, or 2",
      required: ["matchType=0|1|2"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "sort") && !["0", "1"].includes(String(input.sort))) {
    return {
      message: "archives_photo_search sort must be 0 or 1",
      required: ["sort=0|1"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildArchivesPhotoSearchRequest(input) {
  return {
    path: ARCHIVES_PHOTO_SEARCH_PATH,
    displayPath: ARCHIVES_PHOTO_SEARCH_PATH,
    method: "POST",
    body: {
      reportedIds: input.user_id.trim(),
      matchType: Object.hasOwn(input, "matchType") ? String(input.matchType) : "0",
      sort: Object.hasOwn(input, "sort") ? String(input.sort) : "0",
      begin: input.begin,
      end: input.end,
      page: positiveIntegerParam(input, "page", 1),
      count: positiveIntegerParam(input, "count", 20)
    }
  };
}

function validateArchivesPhotoIdInput(actionName) {
  return (input) => {
    if (!isNonEmptyString(input.photo_id) || !/^\d+$/.test(input.photo_id.trim())) {
      return {
        message: `${actionName} requires photo_id as a decimal string`,
        required: ["photo_id decimal string"],
        errorType: "parameter_error"
      };
    }
    return null;
  };
}

function buildArchivesPhotoIdRequest(fixedPath) {
  return (input) => ({
    path: fixedPath,
    displayPath: fixedPath,
    method: "POST",
    body: {
      photoId: input.photo_id.trim()
    }
  });
}

function validateArchivesGalleryPhotoListInput(input) {
  const userError = validateDecimalUserId("archives_gallery_photo_list", input);
  if (userError) {
    return userError;
  }
  const pageError = validatePageControls("archives_gallery_photo_list", input, 100, 20);
  if (pageError) {
    return pageError;
  }
  return null;
}

function buildArchivesGalleryPhotoListRequest(input) {
  return {
    path: ARCHIVES_GALLERY_PHOTO_LIST_PATH,
    displayPath: ARCHIVES_GALLERY_PHOTO_LIST_PATH,
    method: "POST",
    body: {
      userId: input.user_id.trim(),
      pageIndex: positiveIntegerParam(input, "pageIndex", 1),
      pageSize: positiveIntegerParam(input, "pageSize", 20),
      filters: {}
    }
  };
}

function validateArchivesRelatedUsersInput(input) {
  const userError = validateDecimalUserId("archives_related_users", input);
  if (userError) {
    return userError;
  }
  const relationType = archivesRelationType(input);
  if (!Object.hasOwn(ARCHIVES_RELATED_USER_TYPES, relationType)) {
    return {
      message: "archives_related_users relation_type must be same_device_registered or same_device_login",
      required: ["relation_type=same_device_registered|same_device_login"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildArchivesRelatedUsersRequest(input) {
  const relationType = archivesRelationType(input);
  return {
    path: ARCHIVES_RELATED_USERS_PATH,
    displayPath: ARCHIVES_RELATED_USERS_PATH,
    method: "POST",
    body: {
      keyword: input.user_id.trim(),
      inputType: 0,
      type: ARCHIVES_RELATED_USER_TYPES[relationType]
    }
  };
}

function validateArchivesPrivateMessageSearchInput(input) {
  const userError = validateDecimalUserId("archives_private_message_search", input);
  if (userError) {
    return userError;
  }
  if (!Object.hasOwn(ARCHIVES_PRIVATE_MESSAGE_DIRECTIONS, input.direction)) {
    return {
      message: "archives_private_message_search direction must be sent or received",
      required: ["direction=sent|received"],
      errorType: "parameter_error"
    };
  }
  const pageError = validatePageControls("archives_private_message_search", input, 100, 20, "page", "count");
  if (pageError) {
    return pageError;
  }
  if (Object.hasOwn(input, "status") && !safeOptionalShortString(input.status)) {
    return {
      message: "archives_private_message_search status must be a safe short string",
      required: ["status safe string <= 64 chars"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "sort") && !["0", "1"].includes(String(input.sort))) {
    return {
      message: "archives_private_message_search sort must be 0 or 1",
      required: ["sort=0|1"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildArchivesPrivateMessageSearchRequest(input) {
  const directionKey = ARCHIVES_PRIVATE_MESSAGE_DIRECTIONS[input.direction];
  return {
    path: ARCHIVES_PRIVATE_MESSAGE_SEARCH_PATH,
    displayPath: ARCHIVES_PRIVATE_MESSAGE_SEARCH_PATH,
    method: "POST",
    body: {
      [directionKey]: input.user_id.trim(),
      status: Object.hasOwn(input, "status") ? String(input.status) : "",
      sort: Object.hasOwn(input, "sort") ? String(input.sort) : "0",
      page: positiveIntegerParam(input, "page", 1),
      count: positiveIntegerParam(input, "count", 20)
    }
  };
}

function validateArchivesPastFourItemsInput(input) {
  const userError = validateDecimalUserId("archives_past_four_items", input);
  if (userError) {
    return userError;
  }
  const infoTypeError = validateArchivesFourInfoType(input);
  if (infoTypeError) {
    return infoTypeError;
  }
  const pageError = validatePageControls("archives_past_four_items", input, 100, 20, "page", "count");
  if (pageError) {
    return pageError;
  }
  for (const key of ["markResult", "punishResult"]) {
    if (Object.hasOwn(input, key) && !safeOptionalShortString(input[key])) {
      return {
        message: `archives_past_four_items ${key} must be a safe short string`,
        required: [`${key} safe string <= 64 chars`],
        errorType: "invalid_parameter"
      };
    }
  }
  return null;
}

function buildArchivesPastFourItemsRequest(input) {
  return {
    path: ARCHIVES_PAST_FOUR_ITEMS_PATH,
    displayPath: ARCHIVES_PAST_FOUR_ITEMS_PATH,
    method: "POST",
    body: {
      keyword: input.user_id.trim(),
      infoType: archivesFourInfoTypeValue(input),
      markResult: Object.hasOwn(input, "markResult") ? String(input.markResult) : "",
      punishResult: Object.hasOwn(input, "punishResult") ? String(input.punishResult) : "",
      page: positiveIntegerParam(input, "page", 1),
      count: positiveIntegerParam(input, "count", 20)
    }
  };
}

function validateRcpEventIdentityInput(input) {
  return validateRcpEventIdentityForAction("rcp_event_detail", input);
}

function validateRcpEventIdentityForAction(actionName, input) {
  if (!safeCode(input.eventType)) {
    return {
      message: `${actionName} requires a safe eventType`,
      required: ["eventType"],
      errorType: "parameter_error"
    };
  }
  if (!safeCode(input.eventId)) {
    return {
      message: `${actionName} requires a safe eventId`,
      required: ["eventId"],
      errorType: "parameter_error"
    };
  }
  if (!validPositiveInteger(input.queryTime)) {
    return {
      message: `${actionName} requires queryTime as a positive epoch millisecond integer`,
      required: ["queryTime positive integer"],
      errorType: "parameter_error"
    };
  }
  return null;
}

function validateRcpPolicyIdentityForAction(actionName, input) {
  if (!safeCode(input.policyCode)) {
    return {
      message: `${actionName} requires a safe policyCode`,
      required: ["policyCode"],
      errorType: "parameter_error"
    };
  }
  if (!validPositiveInteger(input.policyVersion)) {
    return {
      message: `${actionName} requires policyVersion as a positive integer`,
      required: ["policyVersion positive integer"],
      errorType: "parameter_error"
    };
  }
  return null;
}

function buildRcpEventDetailRequest(input) {
  const params = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: input.eventId.trim(),
    queryTime: String(input.queryTime)
  });
  const displayParams = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: "[typed_event_id]",
    queryTime: String(input.queryTime)
  });
  return {
    path: `${RCP_EVENT_DETAIL_PATH}?${params.toString()}`,
    displayPath: `${RCP_EVENT_DETAIL_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpEventFeatureListInput(input) {
  const eventError = validateRcpEventIdentityInput(input);
  if (eventError) {
    return {
      ...eventError,
      message: eventError.message.replace("rcp_event_detail", "rcp_event_feature_list")
    };
  }
  if (Object.hasOwn(input, "featureGroup") && input.featureGroup !== "") {
    return {
      message: "rcp_event_feature_list featureGroup must remain an empty string",
      required: ["featureGroup empty string"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildRcpEventFeatureListRequest(input) {
  const params = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: input.eventId.trim(),
    queryTime: String(input.queryTime),
    featureGroup: ""
  });
  const displayParams = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: "[typed_event_id]",
    queryTime: String(input.queryTime),
    featureGroup: ""
  });
  return {
    path: `${RCP_EVENT_FEATURE_LIST_PATH}?${params.toString()}`,
    displayPath: `${RCP_EVENT_FEATURE_LIST_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpEventTreeOrDecisionInput(input) {
  const eventError = validateRcpEventIdentityForAction("rcp_event_tree_or_decision", input);
  if (eventError) {
    return eventError;
  }
  const regionError = validateRcpRegion("rcp_event_tree_or_decision", input);
  if (regionError) {
    return regionError;
  }
  if (Object.hasOwn(input, "isPolicyTreeExperiment") && input.isPolicyTreeExperiment !== false) {
    return {
      message: "rcp_event_tree_or_decision isPolicyTreeExperiment must remain false",
      required: ["isPolicyTreeExperiment=false"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildRcpEventTreeOrDecisionRequest(input) {
  const region = rcpRegion(input);
  const params = new URLSearchParams({
    region,
    eventType: input.eventType.trim(),
    eventId: input.eventId.trim(),
    queryTime: String(input.queryTime),
    isPolicyTreeExperiment: "false"
  });
  const displayParams = new URLSearchParams({
    region,
    eventType: input.eventType.trim(),
    eventId: "[typed_event_id]",
    queryTime: String(input.queryTime),
    isPolicyTreeExperiment: "false"
  });
  return {
    path: `${RCP_EVENT_TREE_OR_DECISION_PATH}?${params.toString()}`,
    displayPath: `${RCP_EVENT_TREE_OR_DECISION_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpFastQueryHbaseInput(input) {
  const sourceIds = rcpSourceIdsString(input);
  if (!sourceIds || !validSafeCsv(sourceIds)) {
    return {
      message: "rcp_fast_query_hbase requires source_id or safe sourceIds",
      required: ["source_id or sourceIds safe csv"],
      errorType: "parameter_error"
    };
  }
  if (!validPositiveInteger(input.startTime) || !validPositiveInteger(input.endTime) || input.endTime <= input.startTime) {
    return {
      message: "rcp_fast_query_hbase requires positive epoch startTime/endTime with endTime > startTime",
      required: ["startTime/endTime positive epoch ms"],
      errorType: "parameter_error"
    };
  }
  if (Object.hasOwn(input, "limit") && (!validPositiveInteger(input.limit) || input.limit > 500)) {
    return {
      message: "rcp_fast_query_hbase limit must be a positive integer <= 500",
      required: ["limit positive integer <= 500"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "eventTypeCodes") && !validSafeCsv(eventTypeCodesString(input))) {
    return {
      message: "rcp_fast_query_hbase eventTypeCodes must be a safe comma-separated string or string[]",
      required: ["eventTypeCodes safe csv"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildRcpFastQueryHbaseRequest(input) {
  const sourceIds = rcpSourceIdsString(input);
  const params = new URLSearchParams({
    eventTypeCodes: eventTypeCodesString(input),
    sourceIds,
    startTime: String(input.startTime),
    endTime: String(input.endTime),
    limit: String(positiveIntegerParam(input, "limit", 500))
  });
  const displayParams = new URLSearchParams({
    eventTypeCodes: eventTypeCodesString(input),
    sourceIds: "[typed_source_ids]",
    startTime: String(input.startTime),
    endTime: String(input.endTime),
    limit: String(positiveIntegerParam(input, "limit", 500))
  });
  return {
    path: `${RCP_FAST_QUERY_HBASE_PATH}?${params.toString()}`,
    displayPath: `${RCP_FAST_QUERY_HBASE_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpFeatureInfoByKeysInput(input) {
  const eventError = validateRcpEventIdentityForAction("rcp_feature_info_by_keys", input);
  if (eventError) {
    return eventError;
  }
  const regionError = validateRcpRegion("rcp_feature_info_by_keys", input);
  if (regionError) {
    return regionError;
  }
  const featureKeys = safeCodeListString(input.featureKeys);
  if (!featureKeys) {
    return {
      message: "rcp_feature_info_by_keys requires featureKeys as a safe string or string[]",
      required: ["featureKeys safe string|string[]"],
      errorType: "parameter_error"
    };
  }
  return null;
}

function buildRcpFeatureInfoByKeysRequest(input) {
  const region = rcpRegion(input);
  const params = new URLSearchParams({
    eventId: input.eventId.trim(),
    queryTime: String(input.queryTime),
    isPolicyTreeExperiment: "false",
    eventType: input.eventType.trim(),
    region,
    featureKeys: safeCodeListString(input.featureKeys)
  });
  const displayParams = new URLSearchParams({
    eventId: "[typed_event_id]",
    queryTime: String(input.queryTime),
    isPolicyTreeExperiment: "false",
    eventType: input.eventType.trim(),
    region,
    featureKeys: safeCodeListString(input.featureKeys)
  });
  return {
    path: `${RCP_FEATURE_INFO_BY_KEYS_PATH}?${params.toString()}`,
    displayPath: `${RCP_FEATURE_INFO_BY_KEYS_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpPolicyBasicInfoInput(input) {
  if (!safeCode(input.policyCode)) {
    return {
      message: "rcp_policy_basic_info requires a safe policyCode",
      required: ["policyCode"],
      errorType: "parameter_error"
    };
  }
  if (!safeCode(input.policyTreeCode)) {
    return {
      message: "rcp_policy_basic_info requires a safe policyTreeCode",
      required: ["policyTreeCode"],
      errorType: "parameter_error"
    };
  }
  return null;
}

function buildRcpPolicyBasicInfoRequest(input) {
  const params = new URLSearchParams({
    policyCode: input.policyCode.trim(),
    policyTreeCode: input.policyTreeCode.trim()
  });
  return {
    path: `${RCP_POLICY_BASIC_INFO_PATH}?${params.toString()}`,
    displayPath: `${RCP_POLICY_BASIC_INFO_PATH}?${params.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpPolicyCodeOnlyInput(actionName) {
  return (input) => {
    if (!safeCode(input.policyCode)) {
      return {
        message: `${actionName} requires a safe policyCode`,
        required: ["policyCode"],
        errorType: "parameter_error"
      };
    }
    return null;
  };
}

function buildRcpPolicyCodeOnlyGetRequest(fixedPath) {
  return (input) => {
    const params = new URLSearchParams({ policyCode: input.policyCode.trim() });
    return {
      path: `${fixedPath}?${params.toString()}`,
      displayPath: `${fixedPath}?${params.toString()}`,
      method: "GET",
      body: {}
    };
  };
}

function validateRcpPolicyBindingInfoListInput(input) {
  const policyError = validateRcpPolicyIdentityForAction("rcp_policy_binding_info_list", input);
  if (policyError) {
    return policyError;
  }
  return validatePageControls("rcp_policy_binding_info_list", input, 100, 20, "page", "size");
}

function buildRcpPolicyBindingInfoListRequest(input) {
  const params = new URLSearchParams({
    page: String(positiveIntegerParam(input, "page", 1)),
    size: String(positiveIntegerParam(input, "size", 20)),
    policyCode: input.policyCode.trim(),
    policyVersion: String(input.policyVersion)
  });
  return {
    path: `${RCP_POLICY_BINDING_INFO_LIST_PATH}?${params.toString()}`,
    displayPath: `${RCP_POLICY_BINDING_INFO_LIST_PATH}?${params.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpPolicySearchInput(input) {
  if (Object.hasOwn(input, "policyCode") && input.policyCode !== "" && !safeCode(input.policyCode)) {
    return {
      message: "rcp_policy_search policyCode must be safe when provided",
      required: ["policyCode safe code"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "policyTreeCode") && input.policyTreeCode !== "" && !safeCode(input.policyTreeCode)) {
    return {
      message: "rcp_policy_search policyTreeCode must be safe when provided",
      required: ["policyTreeCode safe code"],
      errorType: "invalid_parameter"
    };
  }
  return validatePageControls("rcp_policy_search", input, 100, 20, "page", "size");
}

function buildRcpPolicySearchRequest(input) {
  return {
    path: RCP_POLICY_SEARCH_PATH,
    displayPath: RCP_POLICY_SEARCH_PATH,
    method: "POST",
    body: {
      policySearchParam: {
        policyCode: isNonEmptyString(input.policyCode) ? input.policyCode.trim() : "",
        policyTreeCode: isNonEmptyString(input.policyTreeCode) ? input.policyTreeCode.trim() : "",
        policyGroupCodes: "",
        punishKey: "",
        reason: "",
        returnMessage: "",
        status: "",
        isProtect: "",
        response: "",
        errorCode: "",
        priority: "",
        createUser: "",
        associated: "",
        updateUser: "",
        scenes: "",
        showCollection: false,
        showOwner: false,
        showHideStatus: false,
        desc: 0
      },
      page: positiveIntegerParam(input, "page", 1),
      size: positiveIntegerParam(input, "size", 20)
    }
  };
}

function buildRcpPolicyBlurSearchRequest(input) {
  const policyCode = isNonEmptyString(input.policyCode) ? input.policyCode.trim() : "";
  const policyTreeCode = isNonEmptyString(input.policyTreeCode) ? input.policyTreeCode.trim() : "";
  const params = new URLSearchParams({
    policyCode,
    page: String(positiveIntegerParam(input, "page", 1)),
    size: String(positiveIntegerParam(input, "size", 20)),
    "formData[policyTreeCode]": policyTreeCode,
    "formData[policyCode]": policyCode,
    "formData[eventTypeAssociator]": "",
    "formData[showCollection]": "false",
    "formData[showOwner]": "false",
    "formData[showHideStatus]": "false"
  });
  return {
    path: `${RCP_POLICY_BLUR_SEARCH_PATH}?${params.toString()}`,
    displayPath: `${RCP_POLICY_BLUR_SEARCH_PATH}?${params.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpPolicyAllVersionInput(input) {
  const policyError = validateRcpPolicyCodeOnlyInput("rcp_policy_all_version")(input);
  if (policyError) {
    return policyError;
  }
  return validatePageControls("rcp_policy_all_version", input, 100, 50, "page", "size");
}

function buildRcpPolicyAllVersionRequest(input) {
  const params = new URLSearchParams({
    page: String(positiveIntegerParam(input, "page", 1)),
    size: String(positiveIntegerParam(input, "size", 50)),
    policyCode: input.policyCode.trim()
  });
  return {
    path: `${RCP_POLICY_ALL_VERSION_PATH}?${params.toString()}`,
    displayPath: `${RCP_POLICY_ALL_VERSION_PATH}?${params.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpPolicyVersionLookupInput(input) {
  const eventError = validateRcpEventIdentityForAction("rcp_policy_version_lookup", input);
  if (eventError) {
    return eventError;
  }
  return validateRcpPolicyIdentityForAction("rcp_policy_version_lookup", input);
}

function buildRcpPolicyVersionLookupRequest(input) {
  const params = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: input.eventId.trim(),
    policyCode: input.policyCode.trim(),
    policyVersion: String(input.policyVersion),
    queryTime: String(input.queryTime)
  });
  const displayParams = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: "[typed_event_id]",
    policyCode: input.policyCode.trim(),
    policyVersion: String(input.policyVersion),
    queryTime: String(input.queryTime)
  });
  return {
    path: `${RCP_POLICY_VERSION_LOOKUP_PATH}?${params.toString()}`,
    displayPath: `${RCP_POLICY_VERSION_LOOKUP_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpPolicyDetailLookupInput(input) {
  return validateRcpPolicyIdentityForAction("rcp_policy_detail_lookup", input);
}

function buildRcpPolicyDetailLookupRequest(input) {
  const params = new URLSearchParams({
    policyCode: input.policyCode.trim(),
    policyVersion: String(input.policyVersion)
  });
  return {
    path: `${RCP_POLICY_DETAIL_LOOKUP_PATH}?${params.toString()}`,
    displayPath: `${RCP_POLICY_DETAIL_LOOKUP_PATH}?${params.toString()}`,
    method: "GET",
    body: {},
    companionPaths: [
      "/v2/rest/pro/policy/getPolicyAllVersion",
      "/v2/rest/pc/policyReview/getRelationPolicyTree"
    ]
  };
}

function validateRcpPolicyReleaseRecordLookupInput(input) {
  if (!safeCode(input.policyCode)) {
    return {
      message: "rcp_policy_release_record_lookup requires a safe policyCode",
      required: ["policyCode"],
      errorType: "parameter_error"
    };
  }
  if (Object.hasOwn(input, "statusCode") && !safeOptionalWorkflowCode(input.statusCode)) {
    return {
      message: "rcp_policy_release_record_lookup statusCode must be a safe workflow status code",
      required: ["statusCode safe string <= 32 chars"],
      errorType: "invalid_parameter"
    };
  }
  const pageError = validatePageControls("rcp_policy_release_record_lookup", input, 100, 20, "page", "size");
  if (pageError) {
    return pageError;
  }
  return null;
}

function buildRcpPolicyReleaseRecordLookupRequest(input) {
  return {
    path: RCP_POLICY_RELEASE_RECORD_PATH,
    displayPath: RCP_POLICY_RELEASE_RECORD_PATH,
    method: "POST",
    body: {
      configCode: "",
      createUser: "",
      extrbA: "",
      extrbB: input.policyCode.trim(),
      extrbC: "",
      pageInfoRequest: {
        page: positiveIntegerParam(input, "page", 1),
        size: positiveIntegerParam(input, "size", 20)
      },
      statusCode: Object.hasOwn(input, "statusCode") ? String(input.statusCode) : ""
    },
    companionPaths: ["/v2/rest/common/pipeline/selectInfo"]
  };
}

function validateRcpPolicyTreeLookupInput(input) {
  if (!safeCode(input.policyTreeCode)) {
    return {
      message: "rcp_policy_tree_lookup requires a safe policyTreeCode",
      required: ["policyTreeCode"],
      errorType: "parameter_error"
    };
  }
  if (!validPositiveInteger(input.policyTreeVersion)) {
    return {
      message: "rcp_policy_tree_lookup requires policyTreeVersion as a positive integer",
      required: ["policyTreeVersion positive integer"],
      errorType: "parameter_error"
    };
  }
  if (Object.hasOwn(input, "targetPolicyCode") && input.targetPolicyCode !== null && input.targetPolicyCode !== undefined && !safeCode(input.targetPolicyCode)) {
    return {
      message: "rcp_policy_tree_lookup targetPolicyCode must be a safe policy code when provided",
      required: ["targetPolicyCode safe code"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildRcpPolicyTreeLookupRequest(input) {
  const params = new URLSearchParams({
    policyTreeCode: input.policyTreeCode.trim(),
    policyTreeVersion: String(input.policyTreeVersion)
  });
  if (isNonEmptyString(input.targetPolicyCode)) {
    params.set("targetPolicyCode", input.targetPolicyCode.trim());
  }
  return {
    path: `${RCP_POLICY_TREE_LOOKUP_PATH}?${params.toString()}`,
    displayPath: `${RCP_POLICY_TREE_LOOKUP_PATH}?${params.toString()}`,
    method: "GET",
    body: {},
    companionPaths: [
      RCP_POLICY_TREE_LIST_PATH,
      RCP_POLICY_TREE_BINDING_BY_NODE_PATH,
      RCP_POLICY_TREE_ALL_POLICY_CODE_PATH
    ],
    targetPolicyCode: isNonEmptyString(input.targetPolicyCode) ? input.targetPolicyCode.trim() : null
  };
}

function validateRcpNodePolicyAttributionInput(input) {
  const eventError = validateRcpEventIdentityForAction("rcp_node_policy_attribution", input);
  if (eventError) {
    return eventError;
  }
  const policyError = validateRcpPolicyIdentityForAction("rcp_node_policy_attribution", input);
  if (policyError) {
    return policyError;
  }
  if (Object.hasOwn(input, "region") && !["china", "oversea", ""].includes(input.region)) {
    return {
      message: "rcp_node_policy_attribution region must be china, oversea, or empty string",
      required: ["region=china|oversea|empty"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "type") && input.type !== "") {
    return {
      message: "rcp_node_policy_attribution type must remain an empty string",
      required: ["type empty string"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildRcpNodePolicyAttributionRequest(input) {
  return {
    path: RCP_NODE_POLICY_ATTRIBUTION_PATH,
    displayPath: RCP_NODE_POLICY_ATTRIBUTION_PATH,
    method: "POST",
    body: {
      eventType: input.eventType.trim(),
      eventId: input.eventId.trim(),
      policyCode: input.policyCode.trim(),
      policyVersion: input.policyVersion,
      queryTime: input.queryTime,
      region: Object.hasOwn(input, "region") ? input.region : "china",
      type: ""
    }
  };
}

function validateRcpNodeBindPolicyAttributionInput(input) {
  const eventError = validateRcpEventIdentityForAction("rcp_node_bind_policy_attribution", input);
  if (eventError) {
    return eventError;
  }
  if (!safeCode(input.policyTreeCode)) {
    return {
      message: "rcp_node_bind_policy_attribution requires a safe policyTreeCode",
      required: ["policyTreeCode"],
      errorType: "parameter_error"
    };
  }
  if (!validPositiveInteger(input.policyTreeVersion)) {
    return {
      message: "rcp_node_bind_policy_attribution requires policyTreeVersion as a positive integer",
      required: ["policyTreeVersion positive integer"],
      errorType: "parameter_error"
    };
  }
  if (!safeCode(input.policyTreeNodeCode)) {
    return {
      message: "rcp_node_bind_policy_attribution requires a safe resolved policyTreeNodeCode",
      required: ["policyTreeNodeCode"],
      errorType: "parameter_error"
    };
  }
  return null;
}

function buildRcpNodeBindPolicyAttributionRequest(input) {
  const params = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: input.eventId.trim(),
    queryTime: String(input.queryTime),
    policyTreeCode: input.policyTreeCode.trim(),
    policyTreeVersion: String(input.policyTreeVersion),
    policyTreeNodeCode: input.policyTreeNodeCode.trim()
  });
  const displayParams = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: "[typed_event_id]",
    queryTime: String(input.queryTime),
    policyTreeCode: input.policyTreeCode.trim(),
    policyTreeVersion: String(input.policyTreeVersion),
    policyTreeNodeCode: input.policyTreeNodeCode.trim()
  });
  return {
    path: `${RCP_NODE_BIND_POLICY_ATTRIBUTION_PATH}?${params.toString()}`,
    displayPath: `${RCP_NODE_BIND_POLICY_ATTRIBUTION_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateTrackAnalysisCheckDataReadyInput(input) {
  if (!isNonEmptyString(input.device_id)) {
    return {
      message: "track_analysis_check_data_ready requires device_id",
      required: ["device_id"],
      errorType: "parameter_error"
    };
  }
  if (!TRACK_ANALYSIS_APP_NAMES.includes(input.appName)) {
    return {
      message: "track_analysis_check_data_ready appName must be KUAISHOU or NEBULA",
      required: ["appName=KUAISHOU|NEBULA"],
      errorType: "parameter_error"
    };
  }
  if (Object.hasOwn(input, "product") && !TRACK_ANALYSIS_APP_NAMES.includes(input.product)) {
    return {
      message: "track_analysis_check_data_ready product must be KUAISHOU or NEBULA",
      required: ["product=KUAISHOU|NEBULA"],
      errorType: "invalid_parameter"
    };
  }
  const windowError = validatePositiveTimeRange("track_analysis_check_data_ready", input, "startTime", "endTime");
  if (windowError) {
    return windowError;
  }
  if (Object.hasOwn(input, "include") && ![0, 1].includes(input.include)) {
    return {
      message: "track_analysis_check_data_ready include must be 0 or 1",
      required: ["include=0|1"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "pageSize") && (!validPositiveInteger(input.pageSize) || input.pageSize > 1000)) {
    return {
      message: "track_analysis_check_data_ready pageSize must be a positive integer <= 1000",
      required: ["pageSize positive integer <= 1000"],
      errorType: "invalid_parameter"
    };
  }
  for (const key of ["category", "event", "appPlatform"]) {
    if (Object.hasOwn(input, key) && !validSafeLabelList(input[key])) {
      return {
        message: `track_analysis_check_data_ready ${key} must be a safe string array`,
        required: [`${key} safe string[]`],
        errorType: "invalid_parameter"
      };
    }
  }
  if (Object.hasOwn(input, "metric") && !safeLabel(input.metric)) {
    return {
      message: "track_analysis_check_data_ready metric must be a safe label",
      required: ["metric safe label"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "type") && input.type !== "deviceId") {
    return {
      message: "track_analysis_check_data_ready type must remain deviceId",
      required: ["type=deviceId"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildTrackAnalysisCheckDataReadyRequest(input) {
  return {
    path: TRACK_ANALYSIS_CHECK_DATA_READY_PATH,
    displayPath: TRACK_ANALYSIS_CHECK_DATA_READY_PATH,
    method: "POST",
    body: {
      appName: input.appName,
      startTime: input.startTime,
      endTime: input.endTime,
      include: Object.hasOwn(input, "include") ? input.include : 1,
      pageSize: positiveIntegerParam(input, "pageSize", 100),
      deviceId: input.device_id.trim(),
      batchQueryId: `browser_backed_${Date.now()}`,
      appPlatform: safeLabelList(input.appPlatform, []),
      category: safeLabelList(input.category, ["active"]),
      event: safeLabelList(input.event, []),
      metric: isNonEmptyString(input.metric) ? input.metric.trim() : "pv",
      product: isNonEmptyString(input.product) ? input.product.trim() : TRACK_ANALYSIS_DEFAULT_PRODUCT,
      type: "deviceId",
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now())
    }
  };
}

function validateTrackAnalysisProductListInput(input) {
  const productError = validateTrackProductFields("track_analysis_product_list", input);
  if (productError) {
    return productError;
  }
  const pageError = validatePageControls("track_analysis_product_list", input, 100, 20, "currentPage", "pageSize");
  if (pageError) {
    return pageError;
  }
  if (Object.hasOwn(input, "keyword") && !safeOptionalKeyword(input.keyword)) {
    return {
      message: "track_analysis_product_list keyword must be a safe string <= 128 chars",
      required: ["keyword safe string <= 128 chars"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "type") && !validPositiveInteger(input.type)) {
    return {
      message: "track_analysis_product_list type must be a positive integer",
      required: ["type positive integer"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "needFavorite") && typeof input.needFavorite !== "boolean") {
    return {
      message: "track_analysis_product_list needFavorite must be boolean",
      required: ["needFavorite boolean"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildTrackAnalysisProductListRequest(input) {
  const product = trackProduct(input);
  const appName = isNonEmptyString(input.appName) ? input.appName.trim() : product;
  const params = new URLSearchParams({ product, appName });
  return {
    path: `${TRACK_ANALYSIS_PRODUCT_LIST_PATH}?${params.toString()}`,
    displayPath: `${TRACK_ANALYSIS_PRODUCT_LIST_PATH}?${params.toString()}`,
    method: "POST",
    body: {
      currentPage: positiveIntegerParam(input, "currentPage", 1),
      pageSize: positiveIntegerParam(input, "pageSize", 20),
      keyword: isNonEmptyString(input.keyword) ? input.keyword.trim() : "",
      type: positiveIntegerParam(input, "type", 1),
      needFavorite: Object.hasOwn(input, "needFavorite") ? input.needFavorite : true
    }
  };
}

function validateTrackProductOnlyInput(actionName) {
  return (input) => validateTrackProductFields(actionName, input);
}

function buildTrackProductOnlyGetRequest(fixedPath) {
  return (input) => {
    const params = new URLSearchParams({
      product: trackProduct(input),
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now())
    });
    return {
      path: `${fixedPath}?${params.toString()}`,
      displayPath: `${fixedPath}?${params.toString()}`,
      method: "GET",
      body: {}
    };
  };
}

function validateTrackProductFields(actionName, input) {
  if (Object.hasOwn(input, "product") && !TRACK_ANALYSIS_APP_NAMES.includes(input.product)) {
    return {
      message: `${actionName} product must be KUAISHOU or NEBULA`,
      required: ["product=KUAISHOU|NEBULA"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "appName") && !TRACK_ANALYSIS_APP_NAMES.includes(input.appName)) {
    return {
      message: `${actionName} appName must be KUAISHOU or NEBULA`,
      required: ["appName=KUAISHOU|NEBULA"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function trackProduct(input) {
  return isNonEmptyString(input.product) ? input.product.trim() : TRACK_ANALYSIS_DEFAULT_PRODUCT;
}

function validateDecimalUserId(actionName, input) {
  if (!isNonEmptyString(input.user_id) || !/^\d+$/.test(input.user_id.trim())) {
    return {
      message: `${actionName} requires user_id as a decimal string`,
      required: ["user_id decimal string"],
      errorType: "parameter_error"
    };
  }
  return null;
}

function validatePositiveTimeRange(actionName, input, startKey, endKey) {
  if (!validPositiveInteger(input[startKey]) || !validPositiveInteger(input[endKey])) {
    return {
      message: `${actionName} requires ${startKey} and ${endKey} as positive epoch millisecond integers`,
      required: [`${startKey}/${endKey} positive integer`],
      errorType: "parameter_error"
    };
  }
  if (input[startKey] >= input[endKey]) {
    return {
      message: `${actionName} requires ${endKey} > ${startKey}`,
      required: [`${endKey} > ${startKey}`],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function validatePageControls(actionName, input, maxSize, defaultSize, pageKey = "pageIndex", sizeKey = "pageSize") {
  if (Object.hasOwn(input, pageKey) && !validPositiveInteger(input[pageKey])) {
    return {
      message: `${actionName} ${pageKey} must be a positive integer`,
      required: [`${pageKey} positive integer`],
      errorType: "invalid_parameter"
    };
  }
  const pageSize = Object.hasOwn(input, sizeKey) ? input[sizeKey] : defaultSize;
  if (!validPositiveInteger(pageSize) || pageSize > maxSize) {
    return {
      message: `${actionName} ${sizeKey} must be a positive integer <= ${maxSize}`,
      required: [`${sizeKey} positive integer <= ${maxSize}`],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function positiveIntegerParam(input, key, defaultValue) {
  return Object.hasOwn(input, key) ? Math.trunc(input[key]) : defaultValue;
}

function archivesRelationType(input) {
  return isNonEmptyString(input.relation_type) ? input.relation_type.trim() : "same_device_registered";
}

function validateArchivesFourInfoType(input) {
  if (Object.hasOwn(input, "info_type") && !Object.hasOwn(ARCHIVES_FOUR_INFO_TYPES, input.info_type)) {
    return {
      message: "archives_past_four_items info_type must be all, username, avatar, profile_description, or background",
      required: ["info_type=all|username|avatar|profile_description|background"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "infoType") && ![0, 1, 2, 3, 4].includes(input.infoType)) {
    return {
      message: "archives_past_four_items infoType must be 0, 1, 2, 3, or 4",
      required: ["infoType=0|1|2|3|4"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "info_type") && Object.hasOwn(input, "infoType")) {
    const expected = ARCHIVES_FOUR_INFO_TYPES[input.info_type];
    if (input.infoType !== expected) {
      return {
        message: "archives_past_four_items infoType must match info_type",
        required: ["matching info_type and infoType"],
        errorType: "invalid_parameter"
      };
    }
  }
  return null;
}

function archivesFourInfoTypeValue(input) {
  if (Object.hasOwn(input, "info_type")) {
    return ARCHIVES_FOUR_INFO_TYPES[input.info_type];
  }
  if (Object.hasOwn(input, "infoType")) {
    return input.infoType;
  }
  return ARCHIVES_FOUR_INFO_TYPES.all;
}

function safeCode(value) {
  return isNonEmptyString(value) && SAFE_CODE_PATTERN.test(value.trim());
}

function safeCodeListString(value) {
  if (isNonEmptyString(value)) {
    return validSafeCsv(value.trim()) ? value.trim() : "";
  }
  if (Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(safeCode)) {
    return value.map((item) => item.trim()).join(",");
  }
  return "";
}

function eventTypeCodesString(input) {
  return Object.hasOwn(input, "eventTypeCodes") ? safeCodeListString(input.eventTypeCodes) : "";
}

function validSafeCsv(value) {
  return typeof value === "string" && value.split(",").every((item) => item === "" || safeCode(item));
}

function validateRcpRegion(actionName, input) {
  if (Object.hasOwn(input, "region") && !["china", "oversea", ""].includes(input.region)) {
    return {
      message: `${actionName} region must be china, oversea, or empty string`,
      required: ["region=china|oversea|empty"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function rcpRegion(input) {
  return Object.hasOwn(input, "region") ? input.region : RCP_DEFAULT_REGION;
}

function safeOptionalShortString(value) {
  return typeof value === "string" && value.length <= 64 && /^[A-Za-z0-9_.:-]*$/.test(value);
}

function safeOptionalKeyword(value) {
  return typeof value === "string" && value.length <= 128 && /^[\w\s.:-]*$/u.test(value);
}

function safeOptionalWorkflowCode(value) {
  return typeof value === "string" && value.length <= 32 && /^[A-Za-z0-9_:-]*$/.test(value);
}

function safeLabel(value) {
  return isNonEmptyString(value) && /^[A-Za-z0-9_.:-]{1,128}$/.test(value.trim());
}

function validSafeLabelList(value) {
  return Array.isArray(value) && value.length <= 50 && value.every(safeLabel);
}

function safeLabelList(value, defaultValue) {
  if (!Array.isArray(value)) {
    return defaultValue;
  }
  return value.filter(safeLabel).map((item) => item.trim()).slice(0, 50);
}

export function actionResponseMode(input, action = null) {
  const responseModes = actionResponseModes(action);
  if (responseModes.includes(input?.response_mode)) {
    return input.response_mode;
  }
  return actionDefaultResponseMode(action);
}

function actionResponseModes(action) {
  return Object.freeze([...(action?.responseModes || RESPONSE_MODES)]);
}

function actionDefaultResponseMode(action) {
  const responseModes = actionResponseModes(action);
  const defaultMode = action?.defaultResponseMode || DEFAULT_RESPONSE_MODE;
  return responseModes.includes(defaultMode) ? defaultMode : responseModes[0];
}

function responseModeContractText(responseModes, defaultResponseMode) {
  return `optional enum ${responseModes.join("|")}; default ${defaultResponseMode}`;
}

function freezeAction(action) {
  normalizeRelativePath(action.apiPath, `${action.name}.apiPath`);
  return Object.freeze({
    expectedContentType: "json",
    ...action
  });
}

function sanitizeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const safe = {};
  for (const key of ALLOWED_INPUT_KEYS) {
    if (Object.hasOwn(input, key)) {
      safe[key] = sanitizeValue(input[key]);
    }
  }

  if (typeof safe.limit === "number") {
    safe.limit = Math.max(Math.trunc(safe.limit), 1);
  }
  if (!RESPONSE_MODES.includes(safe.response_mode)) {
    delete safe.response_mode;
  }

  return safe;
}

function findForbiddenInput(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return /\bhttps?:\/\//i.test(value) ? "url_value" : null;
  }
  if (typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const childValue of value) {
      const childViolation = findForbiddenInput(childValue, depth + 1);
      if (childViolation) {
        return childViolation;
      }
    }
    return null;
  }

  for (const [key, childValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
    if (FORBIDDEN_INPUT_KEYS.includes(normalizedKey)) {
      return key;
    }

    const childViolation = findForbiddenInput(childValue, depth + 1);
    if (childViolation) {
      return childViolation;
    }
  }

  return null;
}

function assertAllowlistMatchesRegistry() {
  const registered = Object.keys(ACTIONS).sort();
  const allowed = [...ACTION_ALLOWLIST].sort();
  if (registered.length !== allowed.length || registered.some((name, index) => name !== allowed[index])) {
    throw new Error("ACTION_ALLOWLIST must exactly match the fixed action registry");
  }
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4) {
    return "[max_depth]";
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value.slice(0, 512);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const safe = {};
    for (const [key, childValue] of Object.entries(value).slice(0, 50)) {
      if (looksSensitive(key)) {
        safe[key] = "[redacted_key]";
      } else {
        safe[key.slice(0, 128)] = sanitizeValue(childValue, depth + 1);
      }
    }
    return safe;
  }
  return String(value).slice(0, 128);
}

function looksSensitive(key) {
  return /(authorization|cookie|token|secret|session|password|credential|csrf|jwt)/i.test(key);
}

function passthroughSafety({ upstreamBusinessBodyVisible = false } = {}) {
  return {
    credential_material_output: false,
    request_headers_output: false,
    browser_profile_material_output: false,
    transport_auth_material_output: false,
    upstream_business_body_visible: Boolean(upstreamBusinessBodyVisible)
  };
}

function contentTypeFromFetchResult(fetchResult) {
  const contentType = fetchResult?.contentType || fetchResult?.content_type || null;
  if (typeof contentType === "string" && contentType.trim()) {
    return contentType.trim().slice(0, 256);
  }
  const parsed = parseJson(fetchResult?.bodyText);
  return parsed.ok ? "application/json" : "text/plain";
}

function buildReturnedUpstreamBody(bodyText, contentType, { truncated = false } = {}) {
  const text = typeof bodyText === "string" ? bodyText : "";
  const returnedBytes = Buffer.byteLength(text, "utf8");
  if (truncated) {
    return {
      body: text,
      returnedBytes
    };
  }

  if (isJsonContentType(contentType)) {
    const parsed = parseJson(text);
    if (parsed.ok) {
      return {
        body: parsed.value,
        returnedBytes
      };
    }
  }

  return {
    body: text,
    returnedBytes
  };
}

function detectUnexpectedHtmlApiResponse(action, contentType, bodyText) {
  if (action?.expectedContentType !== "json") {
    return false;
  }
  const type = String(contentType || "").toLowerCase();
  if (type.includes("text/html")) {
    return true;
  }
  const text = typeof bodyText === "string" ? bodyText.trimStart().slice(0, 512).toLowerCase() : "";
  return text.startsWith("<!doctype html") || text.startsWith("<html") || /<html[\s>]/i.test(text);
}

function normalizeJsonArrayCap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const ok = Boolean(value.ok);
  const observedRecords = safeNonNegativeInteger(value.observedRecords);
  const returnedRecords = safeNonNegativeInteger(value.returnedRecords);
  const missingRecords = safeNonNegativeInteger(value.missingRecords);
  return {
    attempted: Boolean(value.attempted),
    ok,
    path: typeof value.path === "string" && value.path.trim() ? value.path.trim().slice(0, 256) : null,
    observedRecords,
    returnedRecords,
    missingRecords,
    maxRecords: safeNonNegativeInteger(value.maxRecords),
    capReason: normalizeCapReason(value.capReason),
    errorType: typeof value.errorType === "string" ? value.errorType.slice(0, 128) : null
  };
}

function normalizeCapReason(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (["record_limit", "byte_limit", "response_too_large"].includes(text)) {
    return text;
  }
  return null;
}

function safeNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.trunc(number);
}

function isJsonContentType(contentType) {
  return typeof contentType === "string" && /\bjson\b/i.test(contentType);
}

function localRequestId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `local_${Date.now().toString(36)}_${random}`;
}

function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function validateWeaponInventoryInput(input) {
  const hasUserId = isNonEmptyString(input.user_id);
  const hasDeviceId = isNonEmptyString(input.device_id);
  if (hasUserId === hasDeviceId) {
    return {
      message: "weapon_inventory requires exactly one of user_id or device_id",
      required: ["user_id xor device_id"],
      errorType: "parameter_error"
    };
  }

  if (Object.hasOwn(input, "product") && input.product !== WEAPON_DEFAULT_PRODUCT) {
    return {
      message: "weapon_inventory product must be KUAISHOU",
      required: ["product=KUAISHOU"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "productName") && input.productName !== WEAPON_DEFAULT_PRODUCT_NAME) {
    return {
      message: "weapon_inventory productName must be KUAISHOU",
      required: ["productName=KUAISHOU"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "searchLevel") && !validPositiveInteger(input.searchLevel)) {
    return {
      message: "weapon_inventory searchLevel must be a positive integer",
      required: ["searchLevel positive integer"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "include_risk_data") && typeof input.include_risk_data !== "boolean") {
    return {
      message: "weapon_inventory include_risk_data must be boolean",
      required: ["include_risk_data boolean"],
      errorType: "invalid_parameter"
    };
  }

  if (
    Object.hasOwn(input, "max_device_ids") &&
    (!validPositiveInteger(input.max_device_ids) || input.max_device_ids > WEAPON_MAX_DEVICE_IDS)
  ) {
    return {
      message: `weapon_inventory max_device_ids must be a positive integer <= ${WEAPON_MAX_DEVICE_IDS}`,
      required: [`max_device_ids positive integer <= ${WEAPON_MAX_DEVICE_IDS}`],
      errorType: "invalid_parameter"
    };
  }

  return null;
}

function buildWeaponInventoryRequest(input) {
  const scope = weaponEntityScope(input);
  const product = weaponProduct(input);
  const productName = weaponProductName(input);
  const searchLevel = weaponSearchLevel(input);
  const params = new URLSearchParams({
    product,
    productName,
    groupValue: scope.value,
    groupKey: scope.groupKey,
    dimKey: scope.dimKey,
    searchLevel: String(searchLevel)
  });
  const displayParams = new URLSearchParams({
    product,
    productName,
    groupValue: `[typed_${scope.entityType}]`,
    groupKey: scope.groupKey,
    dimKey: scope.dimKey,
    searchLevel: String(searchLevel)
  });

  return {
    path: `${WEAPON_GRAPH_DATA_PATH}?${params.toString()}`,
    displayPath: `${WEAPON_GRAPH_DATA_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {},
    followUp: {
      type: "weapon_graph_risk",
      riskDataPath: WEAPON_RISK_DATA_PATH,
      product,
      includeRiskData: weaponIncludeRiskData(input),
      maxDeviceIds: weaponMaxDeviceIds(input)
    }
  };
}

function weaponEntityScope(input) {
  if (isNonEmptyString(input.device_id)) {
    return {
      entityType: "device_id",
      value: input.device_id.trim(),
      groupKey: "DEVICE_ID",
      dimKey: "USER_ID"
    };
  }
  return {
    entityType: "user_id",
    value: input.user_id.trim(),
    groupKey: "USER_ID",
    dimKey: "DEVICE_ID"
  };
}

function weaponProduct(input) {
  return isNonEmptyString(input.product) ? input.product.trim() : WEAPON_DEFAULT_PRODUCT;
}

function weaponProductName(input) {
  return isNonEmptyString(input.productName) ? input.productName.trim() : WEAPON_DEFAULT_PRODUCT_NAME;
}

function weaponSearchLevel(input) {
  return Object.hasOwn(input, "searchLevel") ? Math.trunc(input.searchLevel) : WEAPON_DEFAULT_SEARCH_LEVEL;
}

function weaponIncludeRiskData(input) {
  return Object.hasOwn(input, "include_risk_data") ? input.include_risk_data : WEAPON_DEFAULT_INCLUDE_RISK_DATA;
}

function weaponMaxDeviceIds(input) {
  return Object.hasOwn(input, "max_device_ids") ? Math.trunc(input.max_device_ids) : WEAPON_DEFAULT_MAX_DEVICE_IDS;
}

function validateLoginLogsInput(input) {
  if (!isNonEmptyString(input.user_id)) {
    return {
      message: "login_logs_search requires user_id",
      required: ["user_id"],
      errorType: "parameter_error"
    };
  }

  const windowValidation = validateLoginLogsWindow(input);
  if (windowValidation) {
    return windowValidation;
  }

  if (Object.hasOwn(input, "recallSource") && !validRecallSource(input.recallSource)) {
    return {
      message: "login_logs_search recallSource must be comma-separated digits",
      required: ["recallSource comma-separated digits"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "limit") && (!validPositiveInteger(input.limit) || input.limit > LOGIN_LOGS_MAX_LIMIT)) {
    return {
      message: `login_logs_search limit must be a positive integer <= ${LOGIN_LOGS_MAX_LIMIT}`,
      required: [`limit positive integer <= ${LOGIN_LOGS_MAX_LIMIT}`],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "max_records") && (!validPositiveInteger(input.max_records) || input.max_records > LOGIN_LOGS_MAX_SERVICE_ROW_CAP)) {
    return {
      message: `login_logs_search max_records must be a positive integer <= ${LOGIN_LOGS_MAX_SERVICE_ROW_CAP}`,
      required: [`max_records positive integer <= ${LOGIN_LOGS_MAX_SERVICE_ROW_CAP}`],
      errorType: "invalid_parameter"
    };
  }

  return null;
}

function validateLoginLogsWindow(input) {
  const window = loginLogsTimeWindow(input);
  if (!Number.isSafeInteger(window.from) || !Number.isSafeInteger(window.to)) {
    return {
      message: "login_logs_search timestamps must be epoch milliseconds",
      required: ["from_timestamp/to_timestamp epoch ms"],
      errorType: "invalid_parameter"
    };
  }
  if (window.from <= 0 || window.to <= 0 || window.to <= window.from) {
    return {
      message: "login_logs_search requires to_timestamp > from_timestamp",
      required: ["to_timestamp > from_timestamp"],
      errorType: "invalid_parameter"
    };
  }
  if (window.to - window.from > LOGIN_LOGS_MAX_WINDOW_MS) {
    return {
      message: "login_logs_search time window must not exceed 7 days",
      required: ["time window <= 7 days"],
      errorType: "query_window_too_large",
      sourceStatus: "parameter_error"
    };
  }
  return null;
}

function buildLoginLogsRequest(input) {
  const window = loginLogsTimeWindow(input);
  const recallSource = loginLogsRecallSource(input);
  const params = new URLSearchParams({
    userId: input.user_id.trim(),
    from_timestamp: String(window.from),
    to_timestamp: String(window.to),
    recallSource
  });
  const displayParams = new URLSearchParams({
    userId: "[typed_user_id]",
    from_timestamp: String(window.from),
    to_timestamp: String(window.to),
    recallSource
  });

  return {
    path: `${LOGIN_LOGS_SEARCH_PATH}?${params.toString()}`,
    displayPath: `${LOGIN_LOGS_SEARCH_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {},
    responseBodyCap: {
      kind: "json_array",
      path: LOGIN_LOGS_JSON_CAP_PATH,
      pathLabel: LOGIN_LOGS_JSON_CAP_PATH.join("."),
      maxRecords: loginLogsServiceRowCap(input)
    }
  };
}

function loginLogsTimeWindow(input) {
  const rawWindow = input.time_window && typeof input.time_window === "object" && !Array.isArray(input.time_window)
    ? input.time_window
    : {};
  const from = firstNumberValue(input.from_timestamp, rawWindow.from_timestamp, rawWindow.from, rawWindow.startTime);
  const to = firstNumberValue(input.to_timestamp, rawWindow.to_timestamp, rawWindow.to, rawWindow.endTime);
  if (from !== null || to !== null) {
    return {
      from: from ?? NaN,
      to: to ?? NaN
    };
  }

  const now = Date.now();
  return {
    from: now - LOGIN_LOGS_DEFAULT_WINDOW_MS,
    to: now
  };
}

function firstNumberValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const number = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(number)) {
      return Math.trunc(number);
    }
    return NaN;
  }
  return null;
}

function loginLogsRecallSource(input) {
  return isNonEmptyString(input.recallSource) ? input.recallSource.trim() : LOGIN_LOGS_DEFAULT_RECALL_SOURCE;
}

function loginLogsLimit(input) {
  return Object.hasOwn(input, "limit") ? Math.trunc(input.limit) : LOGIN_LOGS_DEFAULT_LIMIT;
}

function loginLogsServiceRowCap(input) {
  if (Object.hasOwn(input, "max_records")) {
    return Math.trunc(input.max_records);
  }
  if (Object.hasOwn(input, "limit")) {
    return Math.min(loginLogsLimit(input), LOGIN_LOGS_MAX_SERVICE_ROW_CAP);
  }
  return LOGIN_LOGS_DEFAULT_SERVICE_ROW_CAP;
}

function validRecallSource(value) {
  return typeof value === "string" && /^\d+(,\d+)*$/.test(value.trim());
}

function validateRcpSnapshotInput(input) {
  const timeValidation = validateRcpTimeInput(input);
  if (timeValidation) {
    return timeValidation;
  }

  if (Object.hasOwn(input, "eventType") && !isNonEmptyString(input.eventType)) {
    return {
      message: "rcp_snapshot eventType must be a non-empty string",
      required: ["eventType string"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "source_id") && !isNonEmptyString(input.source_id)) {
    return {
      message: "rcp_snapshot source_id must be a non-empty string",
      required: ["source_id string"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "sourceIds") && rcpSourceIdsString(input) === null) {
    return {
      message: "rcp_snapshot sourceIds must be a string or string array",
      required: ["sourceIds string|string[]"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "device_id") && !isNonEmptyString(input.device_id)) {
    return {
      message: "rcp_snapshot device_id must be a non-empty string",
      required: ["device_id string"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "selected_columns") && !validRcpSelectedColumns(input.selected_columns)) {
    return {
      message: "rcp_snapshot selected_columns must be an array of column names",
      required: ["selected_columns string[]"],
      errorType: "wrong_request_body_shape"
    };
  }

  if (Object.hasOwn(input, "page") && !validPositiveInteger(input.page)) {
    return {
      message: "rcp_snapshot page must be a positive integer",
      required: ["page positive integer"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "pageIndex") && !validPositiveInteger(input.pageIndex)) {
    return {
      message: "rcp_snapshot pageIndex must be a positive integer",
      required: ["pageIndex positive integer"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "pageSize") && (!validPositiveInteger(input.pageSize) || input.pageSize > RCP_MAX_PAGE_SIZE)) {
    return {
      message: `rcp_snapshot pageSize must be a positive integer <= ${RCP_MAX_PAGE_SIZE}`,
      required: [`pageSize positive integer <= ${RCP_MAX_PAGE_SIZE}`],
      errorType: "invalid_parameter"
    };
  }

  return null;
}

function validateRcpTimeInput(input) {
  const directStart = Object.hasOwn(input, "startTime") ? input.startTime : undefined;
  const directEnd = Object.hasOwn(input, "endTime") ? input.endTime : undefined;
  const rawWindow = input.time_window && typeof input.time_window === "object" && !Array.isArray(input.time_window)
    ? input.time_window
    : {};
  const windowStart = Object.hasOwn(rawWindow, "startTime") ? rawWindow.startTime : undefined;
  const windowEnd = Object.hasOwn(rawWindow, "endTime") ? rawWindow.endTime : undefined;
  const providedStart = directStart ?? windowStart;
  const providedEnd = directEnd ?? windowEnd;

  if ((providedStart === undefined) !== (providedEnd === undefined)) {
    return {
      message: "rcp_snapshot requires startTime and endTime together",
      required: ["startTime and endTime"],
      errorType: "wrong_time_field_format"
    };
  }

  if (providedStart === undefined && providedEnd === undefined) {
    return null;
  }

  if (!validRcpTimeString(providedStart) || !validRcpTimeString(providedEnd)) {
    return {
      message: "rcp_snapshot time fields must use YYYY-MM-DD HH:mm:ss",
      required: ["startTime/endTime format YYYY-MM-DD HH:mm:ss"],
      errorType: "wrong_time_field_format"
    };
  }

  if (providedEnd <= providedStart) {
    return {
      message: "rcp_snapshot endTime must be later than startTime",
      required: ["endTime > startTime"],
      errorType: "invalid_parameter"
    };
  }

  return null;
}

function buildRcpSnapshotRequest(input) {
  const timeWindow = rcpTimeWindow(input);
  const tableHeaderList = rcpTableHeaderList(input.selected_columns);
  const pageIndex = rcpPageIndex(input);
  const pageSize = Object.hasOwn(input, "pageSize") ? Math.trunc(input.pageSize) : RCP_DEFAULT_PAGE_SIZE;
  const conditionList = rcpConditionList(input);
  const body = rcpEventListHarBodyTemplate();

  body.tableHeaderList = tableHeaderList;
  body.startTime = timeWindow.startTime;
  body.endTime = timeWindow.endTime;
  body.currentTime = timeWindow.currentTime;
  body.eventV2.eventType = isNonEmptyString(input.eventType) ? input.eventType.trim() : RCP_DEFAULT_EVENT_TYPE;
  body.eventV2.sourceIds = rcpSourceIdsString(input) || "";
  body.eventV2.conditionList = conditionList;
  body.pageIndex = pageIndex;
  body.pageSize = pageSize;

  return {
    path: RCP_EVENT_LIST_PATH,
    method: "POST",
    body
  };
}

function validateTrackAnalysisInput(input) {
  const hasUserId = typeof input.user_id === "string" && input.user_id.trim().length > 0;
  const hasDeviceId = typeof input.device_id === "string" && input.device_id.trim().length > 0;
  const subInterface = trackAnalysisSubInterface(input);
  if (hasUserId === hasDeviceId) {
    return {
      message: "track_analysis_summary requires exactly one of user_id or device_id",
      required: ["user_id xor device_id", "appName"]
    };
  }
  if (!TRACK_ANALYSIS_SUB_INTERFACES.includes(subInterface)) {
    return {
      message: "track_analysis_summary sub_interface must be getLastestDateTime, getUseDuration, profile, or getDeviceIds",
      required: ["sub_interface=getLastestDateTime|getUseDuration|profile|getDeviceIds"]
    };
  }
  if (typeof input.appName !== "string" || !TRACK_ANALYSIS_APP_NAMES.includes(input.appName)) {
    return {
      message: "track_analysis_summary requires appName to be KUAISHOU or NEBULA",
      required: ["appName=KUAISHOU|NEBULA"]
    };
  }
  return null;
}

function buildTrackAnalysisRequest(input) {
  const subInterface = trackAnalysisSubInterface(input);
  if (subInterface === "getUseDuration") {
    return buildTrackAnalysisUseDurationRequest(input);
  }
  if (subInterface === "profile") {
    return buildTrackAnalysisProfileRequest(input);
  }
  if (subInterface === "getDeviceIds") {
    return buildTrackAnalysisDeviceIdsRequest(input);
  }
  return buildTrackAnalysisLatestDateRequest(input);
}

function buildTrackAnalysisLatestDateRequest(input) {
  const entityType = Object.hasOwn(input, "device_id") ? "deviceId" : "userId";
  const params = new URLSearchParams({
    product: input.appName,
    type: entityType,
    funcType: TRACK_ANALYSIS_FUNC_TYPE,
    _t: String(Date.now())
  });
  return {
    path: `${TRACK_ANALYSIS_LATEST_DATE_PATH}?${params.toString()}`,
    method: "GET",
    body: {}
  };
}

function buildTrackAnalysisUseDurationRequest(input) {
  const entityKey = Object.hasOwn(input, "device_id") ? "deviceId" : "userId";
  return {
    path: TRACK_ANALYSIS_USE_DURATION_PATH,
    method: "POST",
    body: {
      appName: input.appName,
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now()),
      [entityKey]: input[entityKey === "deviceId" ? "device_id" : "user_id"]
    }
  };
}

function buildTrackAnalysisProfileRequest(input) {
  const entityKey = Object.hasOwn(input, "device_id") ? "deviceId" : "userId";
  const window = trackAnalysisTimeWindow(input);
  return {
    path: TRACK_ANALYSIS_PROFILE_PATH,
    method: "POST",
    body: {
      appName: input.appName,
      startTime: window.startTime,
      endTime: window.endTime,
      include: 1,
      pageSize: 100,
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now()),
      [entityKey]: input[entityKey === "deviceId" ? "device_id" : "user_id"]
    }
  };
}

function buildTrackAnalysisDeviceIdsRequest(input) {
  const entityKey = Object.hasOwn(input, "device_id") ? "deviceId" : "userId";
  return {
    path: TRACK_ANALYSIS_DEVICE_IDS_PATH,
    method: "POST",
    body: {
      appName: input.appName,
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now()),
      [entityKey]: input[entityKey === "deviceId" ? "device_id" : "user_id"]
    }
  };
}

function trackAnalysisSubInterface(input) {
  return typeof input.sub_interface === "string" ? input.sub_interface : "getLastestDateTime";
}

function trackAnalysisTimeWindow(input) {
  const rawWindow = input.time_window && typeof input.time_window === "object" ? input.time_window : {};
  const startTime = Number(rawWindow.startTime);
  const endTime = Number(rawWindow.endTime);
  if (
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    startTime > 0 &&
    endTime > startTime
  ) {
    return {
      startTime: Math.trunc(startTime),
      endTime: Math.trunc(endTime)
    };
  }

  const end = Date.now();
  return {
    startTime: end - TRACK_ANALYSIS_DEFAULT_WINDOW_MS,
    endTime: end
  };
}

function observedKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value).slice(0, 50).map(safeFieldName);
}

function safeFieldName(key) {
  if (/(authorization|cookie|token|secret|session|password|credential|csrf|jwt)/i.test(key)) {
    return "[redacted_key]";
  }
  if (/^(ANDROID|IOS)_[A-Za-z0-9_.:-]+$/.test(String(key))) {
    return "[masked_device_id_key]";
  }
  if (/^\d{8,}$/.test(String(key))) {
    return "[masked_numeric_id_key]";
  }
  return String(key).slice(0, 128);
}

function readApiCode(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  for (const key of ["code", "result", "status"]) {
    if (typeof value[key] === "number") {
      return value[key];
    }
  }
  return null;
}

function isEmptyPayload(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validRcpTimeString(value) {
  if (typeof value !== "string" || !RCP_TIME_PATTERN.test(value)) {
    return false;
  }

  const [datePart, timePart] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
  );
}

function rcpTimeWindow(input) {
  const rawWindow = input.time_window && typeof input.time_window === "object" && !Array.isArray(input.time_window)
    ? input.time_window
    : {};
  const startTime = Object.hasOwn(input, "startTime") ? input.startTime : rawWindow.startTime;
  const endTime = Object.hasOwn(input, "endTime") ? input.endTime : rawWindow.endTime;

  if (typeof startTime === "string" && typeof endTime === "string") {
    return {
      startTime,
      endTime,
      currentTime: endTime
    };
  }

  const end = new Date();
  const start = new Date(end.getTime() - RCP_DEFAULT_WINDOW_MS);
  return {
    startTime: formatRcpTimestamp(start),
    endTime: formatRcpTimestamp(end),
    currentTime: formatRcpTimestamp(end)
  };
}

function rcpPageIndex(input) {
  if (Object.hasOwn(input, "pageIndex")) {
    return Math.trunc(input.pageIndex);
  }
  if (Object.hasOwn(input, "page")) {
    return Math.trunc(input.page);
  }
  return RCP_DEFAULT_PAGE;
}

function formatRcpTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + " " + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(":");
}

function rcpSourceIdsString(input) {
  if (Object.hasOwn(input, "source_id")) {
    return isNonEmptyString(input.source_id) ? input.source_id.trim() : null;
  }
  if (!Object.hasOwn(input, "sourceIds")) {
    return "";
  }
  if (isNonEmptyString(input.sourceIds)) {
    return input.sourceIds.trim();
  }
  if (Array.isArray(input.sourceIds) && input.sourceIds.length > 0 && input.sourceIds.every(isNonEmptyString)) {
    return input.sourceIds.map((item) => item.trim()).join(",");
  }
  return null;
}

function validRcpSelectedColumns(value) {
  return Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(validRcpColumnName);
}

function validRcpColumnName(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,128}$/.test(value);
}

function rcpTableHeaderList(selectedColumns) {
  const columns = validRcpSelectedColumns(selectedColumns) ? selectedColumns : RCP_DEFAULT_TABLE_COLUMNS;
  return columns.map((column) => ({
    column_name: column,
    column_comment: RCP_COLUMN_COMMENTS[column] || column
  }));
}

function rcpEventListHarBodyTemplate() {
  return {
    tableHeaderList: rcpTableHeaderList(),
    startTime: "",
    endTime: "",
    currentTime: "",
    eventV2: rcpEventV2HarTemplate(),
    pageIndex: RCP_DEFAULT_PAGE,
    pageSize: RCP_DEFAULT_PAGE_SIZE
  };
}

function rcpEventV2HarTemplate() {
  return {
    eventType: RCP_DEFAULT_EVENT_TYPE,
    hitPolicies: "",
    version: RCP_DEFAULT_VERSION,
    status: RCP_DEFAULT_STATUS,
    snapshotVersion: RCP_DEFAULT_SNAPSHOT_VERSION,
    sourceIds: "",
    realTimeOp: RCP_DEFAULT_REAL_TIME_OP,
    isPolicyTreeExperiment: false,
    conditionList: [],
    grayFeature: "",
    grayQueryStatus: 0,
    region: RCP_DEFAULT_REGION
  };
}

function rcpConditionList(input) {
  if (!isNonEmptyString(input.device_id)) {
    return [];
  }
  const condition = rcpConditionItem({
    key: "deviceId",
    value: input.device_id.trim(),
    id: rcpConditionId(0),
    seq: 0,
    description: ""
  });
  return [
    [condition]
  ];
}

function rcpConditionItem({ key, value, id, seq, description }) {
  return {
    key,
    logic: "term",
    value,
    id,
    seq,
    keyType: "主表",
    description,
    rightDataType: "C"
  };
}

function rcpConditionId(seq) {
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function classifyRcpApiError(value) {
  const text = rcpErrorText(value);
  if (/(time|starttime|endtime|yyyy|date|时间|日期)/i.test(text)) {
    return "wrong_time_field_format";
  }
  if (/(tableheaderlist|conditionlist|eventv2|sourceids|body|shape|字段|参数体|请求体)/i.test(text)) {
    return "wrong_request_body_shape";
  }
  if (/(param|parameter|invalid|illegal|参数|无效|非法)/i.test(text)) {
    return "invalid_parameter";
  }
  if (hasRcpStatusMessageWrapper(value)) {
    return "wrong_request_body_shape";
  }
  return "platform_error";
}

function classifyRcpWrapperError(value) {
  if (!hasRcpStatusMessageWrapper(value)) {
    return null;
  }
  return classifyRcpApiError(value);
}

function hasRcpStatusMessageWrapper(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.hasOwn(value, "status") &&
      Object.hasOwn(value, "message")
  );
}

function rcpErrorText(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  return ["message", "msg", "error", "errorMsg", "error_message"]
    .map((key) => value[key])
    .filter((item) => typeof item === "string")
    .join(" ");
}

function rcpWrapperPresence(value) {
  const data = value && typeof value === "object" ? value.data : null;
  return {
    data_eventList: Array.isArray(data?.eventList),
    data_pagination: Boolean(data?.pagination && typeof data.pagination === "object" && !Array.isArray(data.pagination)),
    data_tableHeaderList: Array.isArray(data?.tableHeaderList)
  };
}

function rcpPaginationSummary(pagination) {
  if (!pagination || typeof pagination !== "object" || Array.isArray(pagination)) {
    return null;
  }
  const keys = ["page", "pageSize", "total", "totalCount", "totalPage", "pages", "hasNext"];
  const summary = {};
  for (const key of keys) {
    if (Object.hasOwn(pagination, key) && ["number", "boolean", "string"].includes(typeof pagination[key])) {
      summary[key] = pagination[key];
    }
  }
  return summary;
}

function rcpTableHeaderColumns(tableHeaderList) {
  if (!Array.isArray(tableHeaderList)) {
    return [];
  }
  return tableHeaderList
    .map((item) => {
      if (typeof item === "string") {
        return safeFieldName(item);
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const raw = item.column_name || item.columnName || item.name || item.key || item.dataIndex;
      return typeof raw === "string" ? safeFieldName(raw) : null;
    })
    .filter(Boolean)
    .slice(0, 80);
}

function rcpReturnedColumns(eventList) {
  const columns = [];
  for (const item of eventList.slice(0, 20)) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      columns.push(...observedKeys(item));
    }
  }
  return [...new Set(columns)].slice(0, 80);
}

function returnedColumnsFromFirstEvent(eventList) {
  const first = eventList.find((item) => item && typeof item === "object" && !Array.isArray(item));
  return observedKeys(first);
}

function mockRcpSnapshotData(input) {
  const request = buildRcpSnapshotRequest(input);
  return {
    shape_summary_only: true,
    fixed_path: RCP_EVENT_LIST_PATH,
    request_body_shape: {
      tableHeaderList: "object_array",
      startTime: "YYYY-MM-DD HH:mm:ss",
      endTime: "YYYY-MM-DD HH:mm:ss",
      currentTime: "YYYY-MM-DD HH:mm:ss",
      eventV2: {
        eventType: request.body.eventV2.eventType,
        hitPolicies: "string",
        version: "string",
        status: "number",
        snapshotVersion: "string",
        sourceIds: "string",
        realTimeOp: "string",
        isPolicyTreeExperiment: "boolean",
        conditionList: "array_of_condition_groups",
        grayFeature: "string",
        grayQueryStatus: "number",
        region: "string"
      },
      pageIndex: request.body.pageIndex,
      pageSize: request.body.pageSize
    },
    rcp_snapshot: {
      response_wrapper_paths_present: {
        data_eventList: true,
        data_pagination: true,
        data_tableHeaderList: true
      },
      event_count: 1,
      pagination_summary: {
        page: request.body.pageIndex,
        pageSize: request.body.pageSize,
        total: 1
      },
      table_header_columns: request.body.tableHeaderList.map((column) => column.column_name),
      returned_columns_observed: ["sourceId", "eventId", "_occurTime", "deviceId"],
      first_event_shape_keys: ["sourceId", "eventId", "_occurTime", "deviceId"],
      dynamic_columns_observed: [],
      no_data: false,
      no_data_not_risk_exclusion: true
    },
    generated_at: fixedMockTime()
  };
}

function mockWeaponInventoryData(input) {
  const request = buildWeaponInventoryRequest(input);
  const scope = weaponEntityScope(input);
  const deviceId = scope.entityType === "device_id" ? scope.value : "ANDROID_mock_device_id";
  const graphValue = {
    code: 0,
    data: {
      pointInfoMap: scope.entityType === "device_id"
        ? {
            [deviceId]: { nodeType: "device", deviceId },
            "123456789": { nodeType: "user" }
          }
        : {
            [scope.value]: { nodeType: "user" },
            [deviceId]: { nodeType: "device", deviceId }
          },
      relationEdgeList: [
        { from: scope.value, to: deviceId, relation: "mock_relation" }
      ]
    }
  };
  const riskValue = {
    code: 0,
    data: [
      {
        deviceId,
        productName: weaponProductName(input),
        labelInfo: [
          { groupName: "mock_group", labelName: "mock_label" }
        ],
        originalLog: {
          eventId: "mock_event",
          occurTime: "2026-05-29 10:00:00"
        },
        userLevel: "mock_level"
      }
    ]
  };
  return {
    fixed_paths: {
      graphData: WEAPON_GRAPH_DATA_PATH,
      riskData: WEAPON_RISK_DATA_PATH
    },
    graph_request: {
      method: request.method,
      display_path: request.displayPath,
      groupKey: scope.groupKey,
      dimKey: scope.dimKey,
      product: weaponProduct(input),
      productName: weaponProductName(input),
      searchLevel: weaponSearchLevel(input)
    },
    risk_chaining: {
      include_risk_data: weaponIncludeRiskData(input),
      max_device_ids: weaponMaxDeviceIds(input),
      device_ids_exposed_raw: false
    },
    graphData: graphValue,
    riskDataResults: [
      {
        ok: true,
        status: 200,
        body: riskValue
      }
    ],
    generated_at: fixedMockTime()
  };
}

function mockLoginLogsData(input) {
  const request = buildLoginLogsRequest(input);
  const mockValue = {
    code: 0,
    data: {
      records: [
        {
          loginTime: loginLogsTimeWindow(input).from + 1000,
          result: "success",
          deviceId: "ANDROID_mock_login_device",
          ip: "10.20.30.40",
          origin: "mock-origin"
        },
        {
          loginTime: loginLogsTimeWindow(input).to - 1000,
          result: "denied",
          deviceId: "IOS_mock_login_device",
          ip: "10.20.30.41",
          origin: "mock-origin"
        }
      ]
    }
  };
  return {
    fixed_path: LOGIN_LOGS_SEARCH_PATH,
    request: {
      method: request.method,
      display_path: request.displayPath,
      recallSource: loginLogsRecallSource(input),
      limit: loginLogsLimit(input)
    },
    response: mockValue,
    generated_at: fixedMockTime()
  };
}

function mockTrackAnalysisActivitySummary(input) {
  if (trackAnalysisSubInterface(input) !== "getUseDuration") {
    return null;
  }
  return {
    rows_count: 3,
    total_duration: 150,
    peak_duration: 90,
    peak_date: "2026-05-28",
    nonzero_days_count: 2,
    date_range_observed: {
      from: "2026-05-26",
      to: "2026-05-28"
    }
  };
}

function mockTrackAnalysisProfileSummary(input) {
  if (trackAnalysisSubInterface(input) !== "profile") {
    return null;
  }
  return {
    profile_sections_observed: [
      "data.deviceIds",
      "data.profile",
      "data.profile.firstLevelProfile",
      "data.profile.secondLevelProfile"
    ],
    first_level_profile_keys_count: 4,
    second_level_profile_keys_count: 3,
    register_time_present: true,
    fan_distribution_present: true,
    active_days_bucket_present: true,
    device_ids_count: 2,
    output_fields_observed: [
      "data.deviceIds",
      "data.profile.firstLevelProfile.userId",
      "data.profile.secondLevelProfile[].label",
      "data.profile.secondLevelProfile[].value"
    ]
  };
}

function mockTrackAnalysisDeviceSummary(input) {
  if (trackAnalysisSubInterface(input) !== "getDeviceIds") {
    return null;
  }
  return {
    device_ids_count: 2,
    device_id_sample_masked: "[masked_device_id:length=17]",
    device_fields_observed: ["deviceId", "deviceModel", "lastActiveTime"],
    device_model_fields_present: true,
    last_active_fields_present: true,
    output_fields_observed: [
      "data.deviceIds[].deviceId",
      "data.deviceIds[].deviceModel",
      "data.deviceIds[].lastActiveTime"
    ]
  };
}

function mockFixedActionData(sectionName, input, request, responseValue, extra = {}) {
  return {
    fixed_path: String(request.path || "").split("?")[0],
    request: {
      method: request.method,
      display_path: request.displayPath || request.path,
      body_fields: Object.keys(request.body || {}),
      companion_paths: request.companionPaths || []
    },
    response: responseValue,
    ...extra,
    generated_at: fixedMockTime()
  };
}

function mockArchivesUserAnalysisData(input) {
  const request = buildArchivesUserAnalysisRequest(input);
  return mockFixedActionData(
    "archives_user_analysis",
    input,
    request,
    {
      code: 0,
      data: {
        dataList: [
          {
            userId: input.user_id,
            deviceId: "ANDROID_mock_archives_device",
            ip: "10.20.30.10",
            eventTime: input.beginTime + 1000,
            operationType: "loginStart",
            result: "SUCCESS"
          }
        ],
        totalCount: 1
      }
    },
    {
      operation_filters: [...ARCHIVES_USER_ANALYSIS_FILTER_FIELDS],
      requestParam_extraParam_suppressed: true
    }
  );
}

function mockArchivesUserProfileData(input) {
  const request = buildArchivesUserProfileRequest(input);
  return mockFixedActionData(
    "archives_user_profile",
    input,
    request,
    {
      code: 0,
      data: {
        userId: input.user_id,
        accountStatus: "shape_only_present",
        labelSummary: { count: 1 },
        riskInfo: { riskInfoPresent: true }
      }
    },
    {
      raw_profile_body_suppressed: true
    }
  );
}

function mockArchivesPhotoSearchData(input) {
  const request = buildArchivesPhotoSearchRequest(input);
  return mockFixedActionData(
    "archives_photo_search",
    input,
    request,
    {
      code: 0,
      data: {
        dataList: [
          {
            userId: input.user_id,
            photoId: "photo_mock_1",
            publishTime: input.begin + 1000,
            status: "shape_only_present"
          }
        ],
        totalCount: 1
      }
    },
    {
      raw_report_text_suppressed: true
    }
  );
}

function mockArchivesPhotoProfileData(input) {
  return {
    code: 1,
    data: {
      userId: "2871834924",
      photoId: input.photo_id,
      photoIp: "10.20.30.50",
      photoMethod: "mock_publish_method",
      uploadSource: "mock_upload_source",
      photoStatus: "shape_only_present",
      reviewStatus: "shape_only_present",
      viewCount: 10,
      likeCount: 1,
      reportCount: 0,
      riskTips: []
    }
  };
}

function mockArchivesPhotoMetaData(input) {
  return {
    code: 1,
    data: {
      photoId: input.photo_id,
      userId: "2871834924",
      photoMeta: {
        uploadSource: "mock_upload_source",
        finalType: "mock_video"
      },
      photoOrigin: "shape_only_present",
      document: {
        createTime: 1780000000000
      },
      finalType: "mock_final_type"
    }
  };
}

function mockArchivesPhotoReportAggregateData(input) {
  return {
    code: 1,
    data: {
      photoId: input.photo_id,
      reportCount: 1,
      reports: [
        {
          reportType: "shape_only_present",
          count: 1
        }
      ]
    }
  };
}

function mockArchivesPhotoUserAutonomyData(input) {
  return {
    code: 1,
    data: {
      photoId: input.photo_id,
      photoSatisfaction: "shape_only_present",
      photoApproval: "shape_only_present"
    }
  };
}

function mockArchivesGalleryPhotoListData(input) {
  const request = buildArchivesGalleryPhotoListRequest(input);
  return {
    code: 1,
    data: {
      dataList: [
        {
          userId: input.user_id,
          photoId: "197323059879",
          caption: "shape_only_present",
          type: 1,
          deleted: false,
          time: 1780000000000,
          reviewInfo: {},
          countStat: {}
        }
      ],
      totalCount: 1,
      pageIndex: request.body.pageIndex,
      pageSize: request.body.pageSize
    }
  };
}

function mockArchivesRelatedUsersData(input) {
  const request = buildArchivesRelatedUsersRequest(input);
  return mockFixedActionData(
    "archives_related_users",
    input,
    request,
    {
      code: 0,
      data: {
        dataList: [
          {
            userId: "123456789",
            deviceId: "ANDROID_mock_related_device",
            relationType: archivesRelationType(input)
          }
        ],
        totalCount: 1
      }
    },
    {
      raw_related_user_profile_suppressed: true
    }
  );
}

function mockArchivesPrivateMessageSearchData(input) {
  const request = buildArchivesPrivateMessageSearchRequest(input);
  return {
    code: 0,
    data: {
      dataList: [
        {
          messageId: "mock_message_1",
          fromUserId: input.direction === "sent" ? input.user_id : "772671837",
          toUserId: input.direction === "received" ? input.user_id : "772671837",
          status: request.body.status,
          direction: input.direction,
          createTime: 1780000001000
        }
      ],
      totalCount: 1,
      page: request.body.page,
      count: request.body.count
    }
  };
}

function mockArchivesPastFourItemsData(input) {
  const request = buildArchivesPastFourItemsRequest(input);
  return {
    code: 0,
    data: {
      dataList: [
        {
          userId: input.user_id,
          infoType: request.body.infoType,
          markResult: request.body.markResult,
          punishResult: request.body.punishResult,
          updateTime: 1780000002000,
          auditStatus: "shape_only_present"
        }
      ],
      totalCount: 1,
      page: request.body.page,
      count: request.body.count
    }
  };
}

function mockRcpEventDetailData(input) {
  const request = buildRcpEventDetailRequest(input);
  return mockFixedActionData(
    "rcp_event_detail",
    input,
    request,
    {
      code: 0,
      data: {
        eventType: input.eventType,
        eventId: input.eventId,
        sourceId: "mock_source_id",
        deviceId: "ANDROID_mock_rcp_device",
        hitFusePolicyCode: "mock_policy_code",
        _occurTime: input.queryTime,
        realTimeFeedback: "shape_only_present"
      }
    },
    {
      raw_detail_body_suppressed: true,
      strategy_event_not_final_judgement: true
    }
  );
}

function mockRcpEventFeatureListData(input) {
  const request = buildRcpEventFeatureListRequest(input);
  return mockFixedActionData(
    "rcp_event_feature_list",
    input,
    request,
    {
      code: 0,
      data: [
        {
          eventType: input.eventType,
          eventId: input.eventId,
          featureGroup: "",
          featureKey: "shape_only_feature",
          checkResult: true
        }
      ]
    },
    {
      raw_feature_values_suppressed: true,
      strategy_feature_snapshot_not_final_judgement: true
    }
  );
}

function mockRcpEventTreeOrDecisionData(input) {
  return {
    code: 0,
    data: {
      eventType: input.eventType,
      eventId: input.eventId,
      queryTime: input.queryTime,
      region: rcpRegion(input),
      isPolicyTreeExperiment: false,
      decisionTree: {
        policyTreeCode: "mock_tree",
        nodes: []
      }
    }
  };
}

function mockRcpFastQueryHbaseData(input) {
  return {
    code: 0,
    data: {
      sourceIds: rcpSourceIdsString(input),
      startTime: input.startTime,
      endTime: input.endTime,
      limit: positiveIntegerParam(input, "limit", 500),
      eventTypeCodes: eventTypeCodesString(input),
      records: [
        {
          eventId: "mock_event_id",
          eventType: "USER_REGISTER_NEW",
          sourceId: rcpSourceIdsString(input).split(",")[0]
        }
      ]
    }
  };
}

function mockRcpFeatureInfoByKeysData(input) {
  return {
    code: 0,
    data: safeCodeListString(input.featureKeys).split(",").map((featureKey) => ({
      eventId: input.eventId,
      eventType: input.eventType,
      queryTime: input.queryTime,
      featureKey,
      featureName: `mock_${featureKey}`,
      defaultFeatureValue: "shape_only_present"
    }))
  };
}

function mockRcpPolicyBasicInfoData(input) {
  return {
    code: 0,
    data: {
      policyCode: input.policyCode,
      policyTreeCode: input.policyTreeCode,
      policyName: "mock_policy_basic_info",
      status: "shape_only_present"
    }
  };
}

function mockRcpRelationPolicyTreeData(input) {
  return {
    code: 0,
    data: {
      policyCode: input.policyCode,
      relationPolicyTrees: [
        {
          policyTreeCode: "mock_relation_tree",
          policyTreeVersion: 1
        }
      ]
    }
  };
}

function mockRcpPolicyBindingInfoListData(input) {
  return {
    code: 0,
    data: {
      list: [
        {
          policyCode: input.policyCode,
          policyVersion: input.policyVersion,
          bindingType: "shape_only_present"
        }
      ],
      page: positiveIntegerParam(input, "page", 1),
      size: positiveIntegerParam(input, "size", 20),
      total: 1
    }
  };
}

function mockRcpPolicySearchData(input) {
  return {
    code: 0,
    data: {
      list: [
        {
          policyCode: isNonEmptyString(input.policyCode) ? input.policyCode : "mock_policy_code",
          policyTreeCode: isNonEmptyString(input.policyTreeCode) ? input.policyTreeCode : "mock_policy_tree"
        }
      ],
      page: positiveIntegerParam(input, "page", 1),
      size: positiveIntegerParam(input, "size", 20),
      total: 1
    }
  };
}

function mockRcpPolicyBlurSearchData(input) {
  return mockRcpPolicySearchData(input);
}

function mockRcpPolicyAllVersionData(input) {
  return {
    code: 0,
    data: {
      policyCode: input.policyCode,
      versions: [
        {
          policyVersion: 1,
          status: "shape_only_present"
        }
      ],
      page: positiveIntegerParam(input, "page", 1),
      size: positiveIntegerParam(input, "size", 50)
    }
  };
}

function mockRcpPipelinePolicyVersionsByCodeData(input) {
  return {
    code: 0,
    data: {
      policyCode: input.policyCode,
      pipelineVersions: [
        {
          version: "mock_pipeline_version",
          status: "shape_only_present"
        }
      ]
    }
  };
}

function mockRcpPolicyVersionLookupData(input) {
  return {
    code: 0,
    data: {
      policyCode: input.policyCode,
      eventType: input.eventType,
      eventId: input.eventId,
      queryTime: input.queryTime,
      versions: [
        {
          policyVersion: input.policyVersion,
          versionStr: `v${input.policyVersion}`,
          status: "shape_only_present"
        }
      ]
    }
  };
}

function mockRcpPolicyDetailLookupData(input) {
  return {
    code: 0,
    data: {
      policyCode: input.policyCode,
      policyVersion: input.policyVersion,
      policyName: "mock_policy_detail",
      conditionList: [
        {
          conditionCode: "mock_condition",
          result: true
        }
      ]
    }
  };
}

function mockRcpPolicyReleaseRecordLookupData(input) {
  const request = buildRcpPolicyReleaseRecordLookupRequest(input);
  return {
    code: 0,
    data: {
      records: [
        {
          businessUnionKey: `${input.policyCode}_1_USER_REGISTER_NEW`,
          pipelineVersion: "mock_pipeline_version",
          statusCode: request.body.statusCode
        }
      ],
      pagination: {
        page: request.body.pageInfoRequest.page,
        size: request.body.pageInfoRequest.size,
        total: 1
      }
    }
  };
}

function mockRcpPolicyTreeLookupData(input) {
  const request = buildRcpPolicyTreeLookupRequest(input);
  return mockFixedActionData(
    "rcp_policy_tree_lookup",
    input,
    request,
    {
      code: 0,
      data: {
        policyTreeCode: input.policyTreeCode,
        policyTreeVersion: input.policyTreeVersion,
        policyTreeNodeCode: "53187346034508",
        targetPolicyCode: input.targetPolicyCode || null,
        children: []
      }
    },
    {
      policyTreeList_is_coarse_filter: true,
      raw_policy_tree_body_suppressed: true,
      raw_node_binding_list_suppressed: true,
      raw_all_policy_code_list_suppressed: true,
      strategy_governance_only: true
    }
  );
}

function mockRcpNodePolicyAttributionData(input) {
  return {
    code: 0,
    data: {
      eventType: input.eventType,
      eventId: input.eventId,
      policyCode: input.policyCode,
      policyVersion: input.policyVersion,
      queryTime: input.queryTime,
      conditionList: [
        {
          conditionCode: "mock_condition",
          result: true
        }
      ]
    }
  };
}

function mockRcpNodeBindPolicyAttributionData(input) {
  return {
    code: 0,
    data: {
      eventType: input.eventType,
      eventId: input.eventId,
      queryTime: input.queryTime,
      policyTreeCode: input.policyTreeCode,
      policyTreeVersion: input.policyTreeVersion,
      policyTreeNodeCode: input.policyTreeNodeCode,
      nodebindingPolicyList: [
        {
          policyCode: "mock_bound_policy",
          result: true
        }
      ]
    }
  };
}

function mockTrackAnalysisCheckDataReadyData(input) {
  const request = buildTrackAnalysisCheckDataReadyRequest(input);
  return mockFixedActionData(
    "track_analysis_check_data_ready",
    input,
    request,
    {
      code: 0,
      message: "shape_only_present",
      data: {
        dateStatus: {
          ready: true
        },
        traceId: "mock_trace_id_value_suppressed"
      }
    },
    {
      readiness_not_evidence: true,
      trace_id_value_suppressed: true
    }
  );
}

function mockTrackAnalysisProductListData(input) {
  return {
    code: 0,
    data: {
      list: [
        {
          appName: isNonEmptyString(input.appName) ? input.appName : TRACK_ANALYSIS_DEFAULT_PRODUCT,
          product: trackProduct(input),
          productName: "shape_only_present"
        }
      ],
      currentPage: positiveIntegerParam(input, "currentPage", 1),
      pageSize: positiveIntegerParam(input, "pageSize", 20),
      total: 1
    }
  };
}

function mockTrackSequenceDimensionListData(input) {
  return {
    code: 0,
    data: [
      {
        product: trackProduct(input),
        funcType: TRACK_ANALYSIS_FUNC_TYPE,
        dimension: "shape_only_present"
      }
    ]
  };
}

function mockTrackDataTypeListData(input) {
  return {
    code: 0,
    data: [
      {
        product: trackProduct(input),
        funcType: TRACK_ANALYSIS_FUNC_TYPE,
        dataType: "shape_only_present"
      }
    ]
  };
}

function fixedMockTime() {
  return "2026-05-29T00:00:00.000Z";
}
