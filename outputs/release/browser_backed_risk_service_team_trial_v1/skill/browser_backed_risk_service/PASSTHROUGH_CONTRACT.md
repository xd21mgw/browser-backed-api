# Passthrough Contract

The local service is a controlled passthrough access layer.

It receives:

- fixed action name
- typed params

It owns:

- fixed action allowlist
- fixed origin key
- fixed method and same-origin path
- browser-backed same-origin fetch
- response size guard
- credential-material output guard

It returns:

- upstream HTTP status
- upstream content type
- upstream business response body when safe and within limits
- envelope metadata
- safety booleans

It does not return:

- request headers
- response `set-cookie` headers
- browser profile files
- browser storage dumps
- Playwright storage state
- caller-provided auth material
- arbitrary URL fetch capability

It does not do:

- business summary
- `source_card`
- `source_quality`
- evidence card
- no-data interpretation
- risk judgment
- next-step recommendation
- DataAgent/Hive calls
- automatic disposal

If an upstream body contains fields that look like reusable authentication
secrets, the service must fail closed or remove those fields before returning
the body. The envelope must keep `safety.credential_material_output=false`.

Risk entity fields in upstream business data, such as `user_id`, `deviceId`,
IP, `eventId`, `sourceId`, and policy codes, are not authentication material by
themselves.
