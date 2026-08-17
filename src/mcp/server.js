/**
 * MCP server (Streamable HTTP) for the Financial Planning System (PRD §6).
 *
 * Mounted at /mcp. Uses the low-level MCP `Server` with plain JSON-Schema tool
 * definitions (from tools.js) so we can expose many tools without a per-tool
 * zod schema. Runs in STATELESS mode (a fresh transport per request), which is
 * the simplest robust pattern for a demo behind a single dyno.
 *
 * Extra convenience endpoints (not part of the MCP spec but handy for demos):
 *   GET /mcp/health     — liveness + tool count
 *   GET /mcp/tools      — human-readable tool catalog
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ApiError, toErrorBody } from '../lib/errors.js';
import { tools, toolsByName } from './tools.js';

const SERVER_INFO = { name: 'financial-planning-mcp', version: '1.0.0' };

/** Build a fresh low-level MCP Server with our tools registered. */
function buildMcpServer() {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  // tools/list — advertise the catalog.
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // tools/call — dispatch to the shared operations layer.
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const tool = toolsByName.get(name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}` } }) }],
      };
    }
    try {
      const result = await tool.handler(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      // Surface validation/lookup errors as tool errors (not transport errors)
      // so the calling agent sees a structured, actionable message.
      const body = err instanceof ApiError ? toErrorBody(err) : { error: { code: 'INTERNAL', message: String(err?.message || err) } };
      return { isError: true, content: [{ type: 'text', text: JSON.stringify(body) }] };
    }
  });

  return server;
}

/**
 * Mount the MCP endpoints onto the Express app.
 * @param {import('express').Express} app
 */
export function mountMcp(app) {
  // Liveness + quick catalog size.
  app.get('/mcp/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: SERVER_INFO.name,
      version: SERVER_INFO.version,
      transport: 'streamable-http',
      toolCount: tools.length,
      timestamp: new Date().toISOString(),
    });
  });

  // Human-readable tool catalog (handy in a browser during a demo).
  app.get('/mcp/tools', (_req, res) => {
    res.json({
      count: tools.length,
      tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    });
  });

  // The MCP endpoint itself. Stateless: build a server + transport per request,
  // connect, handle, and tear down when the response closes.
  const handleMcp = async (req, res) => {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal MCP server error' },
          id: null,
        });
      }
    }
  };

  app.post('/mcp', handleMcp);
  // GET/DELETE on /mcp are used by the Streamable HTTP spec for SSE streams and
  // session teardown; in stateless mode they simply return method-not-allowed.
  const notAllowed = (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. This stateless MCP endpoint accepts POST only.' },
      id: null,
    });
  };
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);
}

export { buildMcpServer };
