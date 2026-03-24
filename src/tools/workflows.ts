import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { extractHubSpotError } from "../types.js";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

function getAccessToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN environment variable is not set");
  return token;
}

async function hubspotFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const token = getAccessToken();
  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    const err = body as { message?: string; category?: string; correlationId?: string };
    const parts: string[] = [];
    if (err?.message) parts.push(err.message);
    if (err?.category) parts.push(`Category: ${err.category}`);
    if (err?.correlationId) parts.push(`Correlation ID: ${err.correlationId}`);
    throw new Error(parts.join(" | ") || `HTTP ${res.status}`);
  }

  return body;
}

export function registerWorkflowTools(server: McpServer) {
  // ── List Workflows ──
  server.tool(
    "hubspot_list_workflows",
    "List all automation workflows in HubSpot.",
    {},
    async () => {
      try {
        const data = await hubspotFetch("/automation/v3/workflows") as {
          workflows?: Array<{
            id: number;
            name: string;
            type: string;
            enabled: boolean;
            insertedAt: number;
            updatedAt: number;
          }>;
        };
        const workflows = (data.workflows || []).map((w) => ({
          id: w.id,
          name: w.name,
          type: w.type,
          enabled: w.enabled,
          insertedAt: new Date(w.insertedAt).toISOString(),
          updatedAt: new Date(w.updatedAt).toISOString(),
        }));
        return {
          content: [{ type: "text", text: JSON.stringify({ total: workflows.length, workflows }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error listing workflows: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Get Workflow ──
  server.tool(
    "hubspot_get_workflow",
    "Get details of a specific HubSpot workflow by ID.",
    {
      workflowId: z.number().describe("The HubSpot workflow ID"),
    },
    async ({ workflowId }) => {
      try {
        const data = await hubspotFetch(`/automation/v3/workflows/${workflowId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error getting workflow: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Enroll Contact in Workflow ──
  server.tool(
    "hubspot_enroll_contact_in_workflow",
    "Enroll a contact (by email address) into a HubSpot workflow.",
    {
      workflowId: z.number().describe("The HubSpot workflow ID"),
      email: z.string().email().describe("Email address of the contact to enroll"),
    },
    async ({ workflowId, email }) => {
      try {
        await hubspotFetch(
          `/automation/v2/workflows/${workflowId}/enrollments/contacts/${encodeURIComponent(email)}`,
          { method: "POST" }
        );
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, message: `Contact ${email} enrolled in workflow ${workflowId}` }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error enrolling contact in workflow: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Unenroll Contact from Workflow ──
  server.tool(
    "hubspot_unenroll_contact_from_workflow",
    "Unenroll a contact (by email address) from a HubSpot workflow.",
    {
      workflowId: z.number().describe("The HubSpot workflow ID"),
      email: z.string().email().describe("Email address of the contact to unenroll"),
    },
    async ({ workflowId, email }) => {
      try {
        await hubspotFetch(
          `/automation/v2/workflows/${workflowId}/enrollments/contacts/${encodeURIComponent(email)}`,
          { method: "DELETE" }
        );
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, message: `Contact ${email} unenrolled from workflow ${workflowId}` }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error unenrolling contact from workflow: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Get Workflow Enrollments ──
  server.tool(
    "hubspot_get_workflow_enrollments",
    "Get contacts currently enrolled in a HubSpot workflow.",
    {
      workflowId: z.number().describe("The HubSpot workflow ID"),
    },
    async ({ workflowId }) => {
      try {
        const data = await hubspotFetch(`/automation/v2/workflows/${workflowId}/enrollments`);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error getting workflow enrollments: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );
}
