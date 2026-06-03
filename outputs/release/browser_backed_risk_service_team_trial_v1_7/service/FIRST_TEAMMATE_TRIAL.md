# 第一次试用：Browser-backed 风控本地透传服务

## A. 你会得到什么

- 一个跑在自己电脑上的本地服务。
- 本地默认服务地址：`http://127.0.0.1:8787`
- Agent 统一使用 `service_base_url` 调用服务；本地试用时默认就是
  `http://127.0.0.1:8787`。
- 服务用你自己的公司登录态和平台权限取数。
- 不共享任何人的账号，也不会给你额外权限。
- 服务不读取、不输出 `cookie` / `token` / `session` / `header`。

## B. 第一次使用步骤

1. 拉代码并进入目录：

```sh
cd /path/to/browser-backed-api-poc
```

2. 安装依赖：

```sh
npm install
```

3. 启动 worker：

```sh
npm run worker:start
```

这是普通用户日常唯一需要记住的命令。它会自动判断：服务已 ready 就直接返回；
服务没启动就先 refresh 再启动；如果需要 SSO、二次验证、扫码、captcha 或账号确认，
它会打开浏览器让你手动完成，完成后继续 refresh/start。

调试时也可以用 `npm run open:profile`、`npm run refresh:once`、`npm run start:live`，
但这些不是日常主入口。

4. 另开一个终端检查健康状态：

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"
curl "$SERVICE_BASE_URL/health"
```

看到 `action_count=37`，并且 `auth_state=ready` 或你要用的 origin ready，即服务正常。

## C. 最小试用接口

把示例里的 `<your_test_user_id>` 换成你自己有权限、平台上可能有数据的测试用户。
如果是本地 Agent / 本地脚本 / curl，`SERVICE_BASE_URL` 保持默认即可。如果 main
Agent 在远程/cloud/Linux，需要使用 Mac Local Worker：service 和 Chrome profile 跑在你
的 Mac 上，远程 main Agent 通过 `BROWSER_BACKED_SERVICE_BASE_URL` 指向 Mac worker /
bridge / tunnel。本 release 只说明 bridge/tunnel 口径，不实现 bridge/tunnel。

远程 main Agent 的低授权日常路径：

```sh
npm run worker:start
npm run worker:expose
```

`worker:expose` 会输出 `service_base_url=http://<mac_ip>:9787`。远程 main Agent
后续直接通过这个 URL 调 `/health`、`/actions` 和 `/actions/<allowlisted_action>`，
不要每个 action 都让 Mac node 执行一次 curl。

远程 main Agent 调 Mac worker 时，你的 Mac 必须开机、联网，browser-backed service
必须正在运行，MyFlicker / Mac node client 必须保持在线，且同一个 Chrome profile 不能被其它
Chrome/Playwright 进程锁住。MyFlicker / Mac node 只负责让远程 main Agent 触达 Mac 上的
受控 status/action 调用，不读取 `cookie` / `token` / `session` / `header`，也不替代
browser-backed service。

不要把 Mac profile 拷到 Linux headless 当作常规路径。联调显示该路径可能让 RCP /
Weapon / Login Logs / Archives 触发 `two_factor_required`。

### 1. 固定 action passthrough 示例

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"

curl -X POST "$SERVICE_BASE_URL/actions/track_analysis_summary" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","sub_interface":"profile","user_id":"<your_test_user_id>","appName":"KUAISHOU"}'
```

### 2. 显式 Archives action 示例

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"

curl -X POST "$SERVICE_BASE_URL/actions/archives_private_message_search" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","user_id":"<your_test_user_id>","direction":"sent","page":1,"count":20}'
```

结果可能是 `no_data` / `auth_blocked` / `param_needed`，这不一定代表服务失败，可能只是样本无数据、本人无权限或参数样本不够。

### 3. 一键用户自测

如果通过 Agent Skill 使用，可以直接说：

```txt
/browser-backed-risk-service 自测用户 403082302
```

请把示例用户换成你自己有权限、平台上可能有数据的测试 `user_id`。

这个命令会让 main agent 调一组默认只读 fixed action：

- `track_analysis_summary`
- `login_logs_search`
- `weapon_inventory`
- `archives_user_profile`

可选时再调 `archives_private_message_search`。`rcp_snapshot` 不是 `user_id` 直查 action，默认不在自测组里。

预期输出只应包含：

- service 状态和 `action_count=37`
- 每个 action 的 envelope 摘要
- 每个 action 的 `live_status`
- main agent 加工后的结构化观察
- missing / blocked sources
- `credential_material_output=false`
- `raw_upstream_body_printed=false`

service 仍然只做 passthrough 取数；字段抽取、表格化、证据包摘要或下一步建议属于 main agent
加工，不是 browser-backed service 输出。

## D. 试用时只记录这些

- `action_name`
- request params
- `http_status`
- `ok`
- `response_mode`
- `upstream.status`
- `upstream.body_present` / `upstream.body_omitted`
- `error_type`
- `safety.credential_material_output`

不要粘贴：

- 完整 `upstream.body`
- request headers
- `cookie` / `token` / `session` / `header`
- Chrome profile
- localStorage / browser storage / Playwright storageState

## E. 常见问题

- 端口 `8787` 连不上：服务没启动，或启动服务的终端关了。
- `auth_state=auth_required`：重新运行 `npm run worker:start`，它会在需要时打开 profile。
- `profile in use`：已有 `start:live` / `open:profile` / `refresh` / Chrome 进程占用同一个 profile，先停掉占用进程。
- `no_data`：可能是样本没数据，不代表服务失败。
- `auth_blocked`：可能是本人权限不足、登录态过期或平台落地页未完成。
- 远程 main Agent 调不通：不要让远程 Agent 直接访问它自己的
  `127.0.0.1:8787`。需要在 Mac 上运行 service，并配置
  `BROWSER_BACKED_SERVICE_BASE_URL` 指向受控 Mac worker / bridge / tunnel。本地试用不
  需要这一步。
- `mac_node_disconnected`：打开 MyFlicker Mac client，确认 node connected，再重试
  `/browser-backed-risk-service 状态`。不要改成 profile copy、cookie 注入或 storageState 注入。
- `service_not_running`：在 Mac 上执行 `npm run worker:start`。
- main agent 机器没有 GUI：推荐 Mac Local Worker，不推荐把 Mac profile 拷到 Linux
  headless。
- 日常不应该每次弹浏览器：保持 Mac worker 常驻，main agent 只调 action。只有首次
  setup、登录过期、Archives/account 确认、`manual_login_required` 时才需要用户打开
  Mac Chrome。

## F. 反馈模板

- 电脑环境：
- 执行到哪一步：
- `action_name`：
- request params：
- `live_status`：
- `error_type`：
- 是否有认证材料输出：
- 截图/日志摘要，不贴完整 body：

## G. Skill 命令入口

如果通过 Agent Skill 使用，优先让 Skill 走命令式流程：

- `/browser-backed-risk-service 安装`
- `/browser-backed-risk-service 启动`
- `/browser-backed-risk-service 状态`
- `/browser-backed-risk-service actions`
- `/browser-backed-risk-service 自测用户 <user_id>`
- `/browser-backed-risk-service 调用 <action> <params>`
- `/browser-backed-risk-service 停止`
- `/browser-backed-risk-service 排障`

Skill 会先确认 `service_base_url` 和 `/health`，再调用 allowlisted action。

Mac worker 常用命令：

- `npm run worker:start`
- `npm run worker:status`
- `npm run worker:stop`
- `npm run worker:doctor`
