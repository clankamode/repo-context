#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildRepoContext } from "./context.js";
import { getConventions, getHotPaths } from "./git.js";
import { assertGitRepo } from "./utils.js";

const server = new Server(
  {
    name: "repo-context",
    version: "0.2.0"
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
      description: "Return complete repo context for a local git repo path (default: .)",
      inputSchema: {
        type: "object",
        properties: {
          repo_path: { type: "string", description: "Local filesystem path to a git repo" }
        }
      }
    },
    {
      name: "get_stack",
      description: "Return detected stack section only for a local git repo path (default: .)",
      inputSchema: {
        type: "object",
        properties: {
          repo_path: { type: "string", description: "Local filesystem path to a git repo" }
        }
      }
    },
    {
      name: "get_hot_paths",
      description: "Return frequently changed files for a local git repo path (default lookback: 30 days)",
      inputSchema: {
        type: "object",
        properties: {
          repo_path: { type: "string", description: "Local filesystem path to a git repo" },
          days: { type: "number", description: "Lookback window in days (default 30)" }
        }
      }
    },
    {
      name: "get_conventions",
      description: "Return commit-convention heuristics for a local git repo path (default: .)",
      inputSchema: {
        type: "object",
        properties: {
          repo_path: { type: "string", description: "Local filesystem path to a git repo" }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as { repo_path?: string; days?: number };
  const repoPath = args.repo_path ?? ".";

  try {
    assertGitRepo(repoPath);

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
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text", text: message }]
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`MCP server failed: ${String(error)}\n`);
  process.exit(1);
});
