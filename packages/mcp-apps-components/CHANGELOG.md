# @mastra/mcp-apps-components

## 0.1.0-alpha.1

### Minor Changes

- Replaced the 11 observability tools with one data tool. Register `dashboardDataTool` next to the dashboard app instead of spreading `observabilityAppTools`. The `@mastra/mcp-apps-components/observability-tools` entry point is removed. ([#29491](https://github.com/mastra-ai/mastra/pull/29491))

  **Before**

  ```ts
  import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
  import { observabilityAppTools } from '@mastra/mcp-apps-components/observability-tools';

  new MCPServer({
    // ...
    appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
    tools: { showDashboard, ...observabilityAppTools },
  });
  ```

  **After**

  ```ts
  import { dashboardDataTool } from '@mastra/mcp-apps-components/dashboard-data-tool';
  import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';

  new MCPServer({
    // ...
    appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
    tools: { showDashboard, dashboardDataTool },
  });
  ```

  As before, the tool runs each observability route as the signed-in caller, with the route's own validation and permission checks, and agents don't see it.

  **Clearer errors in dashboard widgets**

  - If `dashboardDataTool` isn't registered, widgets say so and show how to register it, instead of retrying and failing with a generic error.
  - Invalid requests now fail once with the route's error message, instead of being retried and showing a raw JSON error.

  `@mastra/server` is now an optional peer dependency. Only `@mastra/mcp-apps-components/dashboard-data-tool` needs it.

  **Answering the reads yourself**

  Hosts that answer the dashboard's reads themselves can import the contract from `@mastra/mcp-apps-components/dashboard-renderer` without installing `@mastra/server`: `DASHBOARD_DATA_TOOL_NAME`, `DASHBOARD_DATA_OPERATIONS`, `DASHBOARD_DATA_REQUESTS`, `dashboardDataInputSchema`, and `dashboardDataOutputSchema`.

  Set `projectId` in the dashboard's tool result to tell such a host which project to read. The app sends it as `projectId` on every data tool call:

  ```ts
  execute: async () => ({ definition, scope: 'project' as const, projectId: 'proj_123' }),
  ```

- Added widget pinning to the dashboard app over standard MCP Apps messages, and a `useMcpAppHost` hook for React hosts. ([#29488](https://github.com/mastra-ai/mastra/pull/29488))

  The host sets `mastra.ai/dashboard-pinned-widgets` in its host context to the ids of the widgets it has pinned and advertises `updateModelContext.structuredContent`; each widget then shows a pin button. When the user clicks one, the app sends `ui/update-model-context` with the full list of widgets the user wants pinned under the same key in `structuredContent`. Each entry is `{ widget, scope, defaults? }`; parse it with `dashboardPinnedWidgetsSchema`. The host echoes the update's `mastra.ai/dashboard-pin-request` number back in its host context, so the app knows a declined pin was answered. Pins and drilldowns share one model context, so neither erases the other.

  **Breaking:** the `mastra.ai/dashboard-widget-pin` notification is gone, along with the `DASHBOARD_WIDGET_PIN_NOTIFICATION` and `dashboardWidgetPinNotificationParamsSchema` exports. Hosts that handled it now read the pinned list from `ui/update-model-context` instead.

  ```ts
  // Before
  bridge.fallbackNotificationHandler = async ({ method, params }) => {
    if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
    const pin = dashboardWidgetPinNotificationParamsSchema.parse(params);
  };

  // After
  bridge.onupdatemodelcontext = async ({ structuredContent }) => {
    const pinned = dashboardPinnedWidgetsSchema.safeParse(structuredContent?.[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]);
    return {};
  };
  ```

  React hosts built on `@mastra/playground-ui` can use `useMcpAppHost` from the new `@mastra/mcp-apps-components/host` subpath to wire pinning without handling the messages themselves. The subpath doesn't include the app's HTML.

  ```tsx
  import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
  import { useMcpAppHost } from '@mastra/mcp-apps-components/host';

  const host = useMcpAppHost({ dashboardPins: { pinnedIds, onPinnedChange } });
  <McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
  ```

### Patch Changes

- Added `McpAppHostProvider` to `@mastra/playground-ui/domains/mcps`, so chat hosts can extend the MCP Apps shown in tool cards. A host can add its own keys to each app's host context, and receive each app's raw model context updates along with the app they came from. Host context changes reach the running app without reloading it. Without the provider, MCP Apps work as before. ([#29488](https://github.com/mastra-ai/mastra/pull/29488))

  ```tsx
  import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';

  <McpAppHostProvider
    value={{
      hostContext: app => ({ 'my-host/flag': true }),
      onModelContext: (app, { structuredContent }) => console.log(app.toolCallId, structuredContent),
    }}
  >
    {chat}
  </McpAppHostProvider>;
  ```

- Updated dependencies [[`a0068a9`](https://github.com/mastra-ai/mastra/commit/a0068a9ad1fb0a31ae60a07ecbeae41a32ea4081), [`3cf319b`](https://github.com/mastra-ai/mastra/commit/3cf319b5af74aeebb1b70bd29ec539fbd2af4bb8), [`8960f55`](https://github.com/mastra-ai/mastra/commit/8960f55dec7ebf39b460ee8664509d2924065b86), [`cd369c3`](https://github.com/mastra-ai/mastra/commit/cd369c334cf5af81597d7d61e7419b390f92365b), [`f94beac`](https://github.com/mastra-ai/mastra/commit/f94beac86288cb94e2973c9ed492c8f0d68b919d), [`544224c`](https://github.com/mastra-ai/mastra/commit/544224c38f61d08a0b9952d202366fb3c6cc5bd9), [`f7320ab`](https://github.com/mastra-ai/mastra/commit/f7320abd205aa865e3ae467b7bf82373af30a6aa)]:
  - @mastra/core@1.83.0-alpha.1
  - @mastra/server@1.83.0-alpha.1
  - @mastra/mcp@2.9.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- Added widget pinning to the dashboard MCP App. Hosts that set `mastra.ai/dashboard-pinned-widgets` in their host context to the ids of their pinned widgets get a pin button on each widget. Clicking it sends a `mastra.ai/dashboard-widget-pin` notification with the widget, the dashboard's scope, the date range and filters the user had on (as dashboard `defaults`), and `isPinned`, so the host can render the widget on its own as the user saw it. Each button follows the ids the host sends back, so the host and the app stay in sync. ([#29443](https://github.com/mastra-ai/mastra/pull/29443))

  `DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY`, `DASHBOARD_WIDGET_PIN_NOTIFICATION`, and `dashboardWidgetPinNotificationParamsSchema` are exported from `@mastra/mcp-apps-components/dashboard-renderer`. Parse the params with the schema, since they come from the app's iframe:

  ```typescript
  bridge.fallbackNotificationHandler = async ({ method, params }) => {
    if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
    const parsed = dashboardWidgetPinNotificationParamsSchema.safeParse(params);
    if (!parsed.success) return;
    const { widget, isPinned } = parsed.data;
    const pinned = hostContext[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY];
    if (isPinned === pinned.includes(widget.id)) return;
    const ids = isPinned ? [...pinned, widget.id] : pinned.filter(id => id !== widget.id);
    hostContext = { ...hostContext, [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ids };
    bridge.setHostContext(hostContext);
  };
  ```

### Patch Changes

- Added `@mastra/mcp-apps-components`, prebuilt MCP Apps that render Mastra UI inside any MCP App host such as Mastra Studio. The first app, `dashboardRendererApp`, renders a Mastra dashboard definition with live observability data. ([#29321](https://github.com/mastra-ai/mastra/pull/29321))

  Register the app and `observabilityAppTools` on an `MCPServer`, then link a tool to the app's `ui://` URI:

  ```ts
  import { MCPServer } from '@mastra/mcp';
  import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
  import { observabilityAppTools } from '@mastra/mcp-apps-components/observability-tools';

  export const dashboardServer = new MCPServer({
    id: 'dashboard-server',
    name: 'Dashboard Server',
    version: '1.0.0',
    appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
    tools: { showDashboard, ...observabilityAppTools },
  });
  ```

  The app never reaches the network from its iframe. It reads data through the observability tools, which only apps can call and agents don't see. Each tool runs its observability route as the signed-in caller, with the route's own validation and permission checks.

- Updated dependencies [[`1a078af`](https://github.com/mastra-ai/mastra/commit/1a078afbb1cb4ac73eca047e80d366c57e83e5e8), [`a3caf25`](https://github.com/mastra-ai/mastra/commit/a3caf25629671bb76fdfdef77189443b02f550b8), [`49eaabb`](https://github.com/mastra-ai/mastra/commit/49eaabb19b1a28e3614cc79e82a30ab342530f85), [`4afecea`](https://github.com/mastra-ai/mastra/commit/4afeceaf2de5ae85e9c14d25227805ebaf3eaace), [`944d4bc`](https://github.com/mastra-ai/mastra/commit/944d4bcb13c98c326f326b5a9d870b8a613bf4f5), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0893940`](https://github.com/mastra-ai/mastra/commit/0893940ca2f2017ccb59432fdd93f63748561e3b), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0f2df1f`](https://github.com/mastra-ai/mastra/commit/0f2df1f3d69c25a5bbb6f1f046df30e5a83b8e2b), [`b5acfcd`](https://github.com/mastra-ai/mastra/commit/b5acfcdff695b5c3f42512e4939b3b0eed71ac44), [`aa67776`](https://github.com/mastra-ai/mastra/commit/aa6777693de4d78758e8c4f57e5592fe10bb0b03), [`f611832`](https://github.com/mastra-ai/mastra/commit/f611832d661439f6b2aada795dcc16efdc2b12c3), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`b4fdcf5`](https://github.com/mastra-ai/mastra/commit/b4fdcf59a5df1baeb0c4683bb1e6e0175a37df6d), [`944d4bc`](https://github.com/mastra-ai/mastra/commit/944d4bcb13c98c326f326b5a9d870b8a613bf4f5), [`944d4bc`](https://github.com/mastra-ai/mastra/commit/944d4bcb13c98c326f326b5a9d870b8a613bf4f5), [`a5d56cd`](https://github.com/mastra-ai/mastra/commit/a5d56cd4aaec46f84a1217ab2dd62375b6b5e354), [`c351978`](https://github.com/mastra-ai/mastra/commit/c3519781275689a562e9347121b6316c909c5cdb), [`f9feb98`](https://github.com/mastra-ai/mastra/commit/f9feb98ba33a362ace4db6ad8ec6ac01ca933ca5), [`33d1dc2`](https://github.com/mastra-ai/mastra/commit/33d1dc21107c402d244b3ac372d309e0d8e73199), [`8ad7773`](https://github.com/mastra-ai/mastra/commit/8ad7773cd4f50dd344f047547074607f5bb81ff6), [`a7c4069`](https://github.com/mastra-ai/mastra/commit/a7c4069df2d7207a74916e2ced5cc35dc42bf3b6), [`8ad7773`](https://github.com/mastra-ai/mastra/commit/8ad7773cd4f50dd344f047547074607f5bb81ff6), [`a7c4069`](https://github.com/mastra-ai/mastra/commit/a7c4069df2d7207a74916e2ced5cc35dc42bf3b6), [`2ab2b9b`](https://github.com/mastra-ai/mastra/commit/2ab2b9b494e1033b1415e880cad5f28bf65d32d8)]:
  - @mastra/core@1.83.0-alpha.0
  - @mastra/server@1.83.0-alpha.0
  - @mastra/mcp@2.9.0-alpha.0
