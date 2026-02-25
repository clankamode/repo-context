#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildRepoContext } from "./context.js";
import { getConventions, getHotPaths } from "./git.js";

const server = new Server(
  {
    name: "repo-context",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_context",
      description: "Return complete repo context",
      inputSchema: {
        type: "object",
        properties: {
          repo_path: { type: "string" }
        }
      }
    },
    {
      name: "get_stack",
      description: "Return stack section only",
      inputSchema: {
        type: "object",
        properties: {
          repo_path: { type: "string" }
        }
      }
    },
    {
      name: "get_hot_paths",
      description: "Return hot files",
      inputSchema: {
        type: "object",
        properties: {
          repo_path: { type: "string" },
          days: { type: "number" }
        }
      }
    },
    {
      name: "get_conventions",
      description: "Return conventions section",
      inputSchema: {
        type: "object",
        properties: {
          repo_path: { type: "string" }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as { repo_path?: string; days?: number };
  const repoPath = args.repo_path ?? ".";

  let data: unknown;
  switch (request.params.name) {
    case "get_context":
      data = buildRepoContext(repoPath);
      break;
    case "get_stack":
      data = buildRepoContext(repoPath).stack;
      break;
    case "get_hot_paths":
      data = getHotPaths(repoPath, args.days ?? 30);
      break;
    case "get_conventions":
      data = getConventions(repoPath);
      break;
    default:
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }]
      };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: { result: data as unknown }
  };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`MCP server failed: ${String(error)}\n`);
  process.exit(1);
});
