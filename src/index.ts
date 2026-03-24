#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import all tool modules
import { registerContactTools } from "./tools/contacts.js";
import { registerCompanyTools } from "./tools/companies.js";
import { registerDealTools } from "./tools/deals.js";
import { registerTicketTools } from "./tools/tickets.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerEngagementTools } from "./tools/engagements.js";
import { registerWorkflowTools } from "./tools/workflows.js";
import { registerAssociationTools } from "./tools/associations.js";
import { registerPropertyTools } from "./tools/properties.js";
import { registerPipelineTools } from "./tools/pipelines.js";
import { registerOwnerTools } from "./tools/owners.js";

// Import hubspot-client to trigger validation
import "./hubspot-client.js";

const server = new McpServer({
  name: "hubspot-mcp-tools",
  version: "2.0.0",
});

// Register all tools
// CRM Objects
registerContactTools(server);
registerCompanyTools(server);
registerDealTools(server);
registerTicketTools(server);
registerNoteTools(server);

// Engagements (Calls, Emails, Meetings, Tasks)
registerEngagementTools(server);

// Automation
registerWorkflowTools(server);

// Relationships
registerAssociationTools(server);

// Schema Discovery
registerPropertyTools(server);
registerPipelineTools(server);

// User Management
registerOwnerTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HubSpot MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
