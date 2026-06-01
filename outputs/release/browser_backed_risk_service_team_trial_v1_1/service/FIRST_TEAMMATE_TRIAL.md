# 第一次试用：Browser-backed 风控本地透传服务

## A. 你会得到什么

- 一个跑在自己电脑上的本地服务。
- 服务地址：`http://127.0.0.1:8787`
- 服务用你自己的公司登录态和平台权限取数。
- 不共享 Dennis 的账号，也不会给你额外权限。
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

3. 打开本地服务专用浏览器 profile：

```sh
npm run open:profile
```

浏览器会打开。请自己完成 SSO、登录、二次验证或平台落地页确认。完成后回到终端按 Enter。

4. 刷新一次登录态：

```sh
npm run refresh:once
```

看到 `ok=true` / `auth_state=ready` 就可以继续。

5. 启动本地服务：

```sh
npm run start:live
```

这个终端不要关。

6. 另开一个终端检查健康状态：

```sh
curl http://127.0.0.1:8787/health
```

看到 `action_count=19`，并且 `auth_state=ready` 或你要用的 origin ready，即服务正常。

## C. 最小试用接口

把示例里的 `<your_test_user_id>` 换成你自己有权限、平台上可能有数据的测试用户。

### 1. dual-mode action 的 passthrough 示例

```sh
curl -X POST http://127.0.0.1:8787/actions/track_analysis_summary \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","sub_interface":"profile","user_id":"<your_test_user_id>","appName":"KUAISHOU"}'
```

### 2. passthrough-only action 示例

```sh
curl -X POST http://127.0.0.1:8787/actions/archives_private_message_search \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","user_id":"<your_test_user_id>","direction":"sent","page":1,"count":20}'
```

结果可能是 `no_data` / `auth_blocked` / `param_needed`，这不一定代表服务失败，可能只是样本无数据、本人无权限或参数样本不够。

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
- `auth_state=auth_required`：重新运行 `npm run open:profile`，完成登录后再 `npm run refresh:once`。
- `profile in use`：已有 `start:live` / `open:profile` / `refresh` / Chrome 进程占用同一个 profile，先停掉占用进程。
- `no_data`：可能是样本没数据，不代表服务失败。
- `auth_blocked`：可能是本人权限不足、登录态过期或平台落地页未完成。

## F. 反馈模板

- 电脑环境：
- 执行到哪一步：
- `action_name`：
- request params：
- `live_status`：
- `error_type`：
- 是否有认证材料输出：
- 截图/日志摘要，不贴完整 body：
