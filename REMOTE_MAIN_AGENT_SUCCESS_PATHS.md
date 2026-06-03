# Remote Main Agent Success Paths

This file records the two verified paths for Remote Main Agent + Mac Local
Worker use. It is a deployment note for the Browser-backed Risk Service, not a
new service mode and not a platform-interface contract.

## Verified Install Transfer Path

Use this when the remote/Linux main-agent workspace has the release package but
there is no standard file-transfer API to the user's Mac.

1. Put the release tarball in the Linux/main-agent workspace.
2. Start a temporary HTTP server in that workspace for the release tarball.
3. On the user's Mac, download the tarball with `curl`.
4. Extract the release on the Mac.
5. Enter `service/`.
6. Run `npm install`.
7. Run `npm run worker:doctor`.
8. Run `npm run worker:start`.

This path is a verified fallback for package transfer only. It must not become
a general remote-shell exploration workflow.

Do not use or propose these alternatives as the normal path:

- base64 chunk transfer
- KCDN or ad hoc temporary uploads
- self-designed SSH tunnel exploration
- Chrome profile copy to Linux
- `sso_session.py`
- cookie injection
- storageState injection

## Verified Low-Approval Runtime Path

Use this for day-to-day Remote Main Agent + Mac Local Worker action calls.

1. Mac service listens locally on `http://127.0.0.1:8787`.
2. Mac runs:

```sh
npm run worker:expose
```

3. `worker:expose` starts or reuses a constrained proxy:

```txt
0.0.0.0:9787 -> 127.0.0.1:8787
```

4. The Linux/main agent uses the `service_base_url` printed by
   `worker:expose`.
5. Daily action calls go through HTTP to the Mac worker URL instead of running a
   new Mac node command for every action.

`172.16.114.109:9787` is only an example shape. Do not hardcode it. The actual
`service_base_url` must come from `npm run worker:expose`.

The constrained proxy may forward only:

- `GET /health`
- `GET /actions`
- `POST /actions/<allowlisted_action>`

It must not provide:

- arbitrary URL fetch
- arbitrary platform path access
- Chrome profile access
- cookie, token, session, authorization, password, or request-header access
- localStorage, browser storage, or Playwright storageState access

## Daily Rule

Remote main agents should prefer `BROWSER_BACKED_SERVICE_BASE_URL` when it is
configured and reachable. Mac node commands should be reserved for install,
`worker:start`, `worker:expose`, `worker:status`, `worker:stop`, and
troubleshooting.
