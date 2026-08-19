# Support - Local World Monitor

This page describes the support boundary for the self-hosted local deployment.

## Local deployment

- No account, login, subscription, billing portal, or hosted support channel is required.
- Configure data-provider API keys in the local `.env` file and restart the Docker stack after changing them.
- Use `http://localhost:3000/api/sidecar-health` to confirm the local API sidecar is reachable.
- Use `http://localhost:3000/api/health?compact=1&public=1` to inspect data-source freshness and degradation state.

## Data availability

Some panels depend on optional third-party providers. If a provider is unavailable or its key is missing, the corresponding panel remains usable and displays an empty, stale, or unavailable state instead of blocking the dashboard.

## Machine-readable summary

```json
{
  "product": "World Monitor",
  "deployment": "local-docker",
  "authentication": "disabled",
  "membership": "disabled",
  "health_endpoint": "/api/health?compact=1&public=1",
  "sidecar_endpoint": "/api/sidecar-health"
}
```
