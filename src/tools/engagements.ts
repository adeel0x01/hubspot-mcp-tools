import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import { CrmObjectTypeSchema, extractHubSpotError } from "../types.js";
import { AssociationSpecAssociationCategoryEnum } from "@hubspot/api-client/lib/codegen/crm/associations/v4/models/AssociationSpec.js";

// HubSpot defined association type IDs for each engagement type to CRM objects
const CALL_ASSOCIATION_TYPES: Record<string, number> = {
  contacts: 194,
  companies: 182,
  deals: 206,
  tickets: 220,
};

const EMAIL_ASSOCIATION_TYPES: Record<string, number> = {
  contacts: 198,
  companies: 186,
  deals: 210,
  tickets: 224,
};

const MEETING_ASSOCIATION_TYPES: Record<string, number> = {
  contacts: 200,
  companies: 188,
  deals: 212,
  tickets: 226,
};

const TASK_ASSOCIATION_TYPES: Record<string, number> = {
  contacts: 204,
  companies: 192,
  deals: 216,
  tickets: 228,
};

const AssociationSchema = z
  .object({
    objectType: CrmObjectTypeSchema,
    objectId: z.string(),
  })
  .optional()
  .describe("CRM object to associate this engagement with");

function buildAssociations(
  associateWith: { objectType: string; objectId: string } | undefined,
  typeMap: Record<string, number>
) {
  if (!associateWith) return [];
  const typeId = typeMap[associateWith.objectType];
  if (!typeId) return [];
  return [
    {
      to: { id: associateWith.objectId },
      types: [
        {
          associationCategory:
            AssociationSpecAssociationCategoryEnum.HubspotDefined,
          associationTypeId: typeId,
        },
      ],
    },
  ];
}

const SearchFiltersSchema = z
  .array(
    z.object({
      propertyName: z.string(),
      operator: z.enum([
        "EQ",
        "NEQ",
        "LT",
        "LTE",
        "GT",
        "GTE",
        "CONTAINS_TOKEN",
        "NOT_CONTAINS_TOKEN",
        "HAS_PROPERTY",
        "NOT_HAS_PROPERTY",
      ]),
      value: z.string().optional(),
    })
  )
  .optional()
  .describe("Filter criteria");

// ─── CALLS ───────────────────────────────────────────────────────────────────

export function registerEngagementTools(server: McpServer) {
  // ── Create Call ──
  server.tool(
    "hubspot_create_call",
    "Create a call engagement in HubSpot and optionally associate it with a CRM object.",
    {
      title: z.string().optional().describe("Title of the call"),
      body: z.string().optional().describe("Call notes or description"),
      direction: z
        .enum(["INBOUND", "OUTBOUND"])
        .optional()
        .describe("Call direction"),
      status: z
        .enum(["SCHEDULED", "COMPLETED", "BUSY", "FAILED", "NO_ANSWER", "CANCELED"])
        .optional()
        .describe("Call outcome status"),
      durationMs: z
        .number()
        .optional()
        .describe("Duration of the call in milliseconds"),
      fromNumber: z.string().optional().describe("Caller phone number"),
      toNumber: z.string().optional().describe("Recipient phone number"),
      timestamp: z
        .string()
        .optional()
        .describe("ISO 8601 timestamp of the call (defaults to now)"),
      ownerId: z.string().optional().describe("HubSpot owner ID"),
      associateWith: AssociationSchema,
    },
    async ({ title, body, direction, status, durationMs, fromNumber, toNumber, timestamp, ownerId, associateWith }) => {
      try {
        const properties: Record<string, string> = {
          hs_timestamp: timestamp || new Date().toISOString(),
        };
        if (title) properties.hs_call_title = title;
        if (body) properties.hs_call_body = body;
        if (direction) properties.hs_call_direction = direction;
        if (status) properties.hs_call_status = status;
        if (durationMs !== undefined) properties.hs_call_duration = String(durationMs);
        if (fromNumber) properties.hs_call_from_number = fromNumber;
        if (toNumber) properties.hs_call_to_number = toNumber;
        if (ownerId) properties.hubspot_owner_id = ownerId;

        const response = await hubspotClient.crm.objects.calls.basicApi.create({
          properties,
          associations: buildAssociations(associateWith, CALL_ASSOCIATION_TYPES),
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, createdAt: response.createdAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error creating call: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Get Call ──
  server.tool(
    "hubspot_get_call",
    "Get a specific call engagement by its ID.",
    {
      callId: z.string().describe("The HubSpot call ID"),
      properties: z.array(z.string()).optional().describe("Properties to return"),
    },
    async ({ callId, properties }) => {
      try {
        const defaultProps = ["hs_call_title", "hs_call_body", "hs_call_direction", "hs_call_status", "hs_call_duration", "hs_call_from_number", "hs_call_to_number", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.calls.basicApi.getById(callId, properties || defaultProps);
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, createdAt: response.createdAt, updatedAt: response.updatedAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error getting call: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── List Calls ──
  server.tool(
    "hubspot_list_calls",
    "List call engagements in HubSpot with pagination.",
    {
      limit: z.number().min(1).max(100).default(10).describe("Number of calls to return"),
      after: z.string().optional().describe("Pagination cursor"),
      properties: z.array(z.string()).optional().describe("Properties to return"),
    },
    async ({ limit, after, properties }) => {
      try {
        const defaultProps = ["hs_call_title", "hs_call_body", "hs_call_direction", "hs_call_status", "hs_call_duration", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.calls.basicApi.getPage(limit, after, properties || defaultProps);
        return {
          content: [{ type: "text", text: JSON.stringify({ results: response.results.map(c => ({ id: c.id, properties: c.properties, createdAt: c.createdAt })), paging: response.paging }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error listing calls: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Update Call ──
  server.tool(
    "hubspot_update_call",
    "Update a call engagement's properties.",
    {
      callId: z.string().describe("The HubSpot call ID"),
      title: z.string().optional(),
      body: z.string().optional(),
      direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
      status: z.enum(["SCHEDULED", "COMPLETED", "BUSY", "FAILED", "NO_ANSWER", "CANCELED"]).optional(),
      durationMs: z.number().optional().describe("Duration in milliseconds"),
      fromNumber: z.string().optional(),
      toNumber: z.string().optional(),
      timestamp: z.string().optional(),
      ownerId: z.string().optional(),
    },
    async ({ callId, title, body, direction, status, durationMs, fromNumber, toNumber, timestamp, ownerId }) => {
      try {
        const properties: Record<string, string> = {};
        if (title !== undefined) properties.hs_call_title = title;
        if (body !== undefined) properties.hs_call_body = body;
        if (direction !== undefined) properties.hs_call_direction = direction;
        if (status !== undefined) properties.hs_call_status = status;
        if (durationMs !== undefined) properties.hs_call_duration = String(durationMs);
        if (fromNumber !== undefined) properties.hs_call_from_number = fromNumber;
        if (toNumber !== undefined) properties.hs_call_to_number = toNumber;
        if (timestamp !== undefined) properties.hs_timestamp = timestamp;
        if (ownerId !== undefined) properties.hubspot_owner_id = ownerId;

        if (Object.keys(properties).length === 0) {
          return { content: [{ type: "text", text: "Error: At least one property must be provided to update." }], isError: true };
        }

        const response = await hubspotClient.crm.objects.calls.basicApi.update(callId, { properties });
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, updatedAt: response.updatedAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error updating call: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Delete Call ──
  server.tool(
    "hubspot_delete_call",
    "Archive (soft delete) a call engagement in HubSpot.",
    { callId: z.string().describe("The HubSpot call ID to archive") },
    async ({ callId }) => {
      try {
        await hubspotClient.crm.objects.calls.basicApi.archive(callId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Call ${callId} archived successfully` }, null, 2) }] };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error archiving call: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Search Calls ──
  server.tool(
    "hubspot_search_calls",
    "Search call engagements in HubSpot.",
    {
      query: z.string().optional().describe("Full-text search query"),
      filters: SearchFiltersSchema,
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional(),
      properties: z.array(z.string()).optional(),
    },
    async ({ query, filters, limit, after, properties }) => {
      try {
        const defaultProps = ["hs_call_title", "hs_call_body", "hs_call_direction", "hs_call_status", "hs_call_duration", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.calls.searchApi.doSearch({
          limit,
          after: after || undefined,
          sorts: [],
          properties: properties || defaultProps,
          filterGroups: filters && filters.length > 0 ? [{ filters }] : [],
          ...(query && { query }),
        } as Parameters<typeof hubspotClient.crm.objects.calls.searchApi.doSearch>[0]);
        return {
          content: [{ type: "text", text: JSON.stringify({ total: response.total, results: response.results.map(c => ({ id: c.id, properties: c.properties, createdAt: c.createdAt })), paging: response.paging }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error searching calls: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ─── EMAILS ────────────────────────────────────────────────────────────────

  // ── Create Email ──
  server.tool(
    "hubspot_create_email",
    "Create an email engagement in HubSpot and optionally associate it with a CRM object.",
    {
      subject: z.string().optional().describe("Email subject line"),
      body: z.string().optional().describe("Email body (plain text)"),
      html: z.string().optional().describe("Email body (HTML)"),
      direction: z
        .enum(["EMAIL", "INCOMING_EMAIL", "FORWARDED_EMAIL"])
        .optional()
        .describe("Email direction/type"),
      status: z
        .enum(["SENT", "FAILED", "SCHEDULED", "DRAFT"])
        .optional()
        .describe("Email status"),
      fromEmail: z.string().optional().describe("Sender email address"),
      toEmail: z.string().optional().describe("Recipient email address"),
      timestamp: z.string().optional().describe("ISO 8601 timestamp (defaults to now)"),
      ownerId: z.string().optional().describe("HubSpot owner ID"),
      associateWith: AssociationSchema,
    },
    async ({ subject, body, html, direction, status, fromEmail, toEmail, timestamp, ownerId, associateWith }) => {
      try {
        const properties: Record<string, string> = {
          hs_timestamp: timestamp || new Date().toISOString(),
        };
        if (subject) properties.hs_email_subject = subject;
        if (body) properties.hs_email_text = body;
        if (html) properties.hs_email_html = html;
        if (direction) properties.hs_email_direction = direction;
        if (status) properties.hs_email_status = status;
        if (fromEmail) properties.hs_email_from_email = fromEmail;
        if (toEmail) properties.hs_email_to_email = toEmail;
        if (ownerId) properties.hubspot_owner_id = ownerId;

        const response = await hubspotClient.crm.objects.emails.basicApi.create({
          properties,
          associations: buildAssociations(associateWith, EMAIL_ASSOCIATION_TYPES),
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, createdAt: response.createdAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error creating email engagement: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Get Email ──
  server.tool(
    "hubspot_get_email_engagement",
    "Get a specific email engagement by its ID.",
    {
      emailId: z.string().describe("The HubSpot email engagement ID"),
      properties: z.array(z.string()).optional().describe("Properties to return"),
    },
    async ({ emailId, properties }) => {
      try {
        const defaultProps = ["hs_email_subject", "hs_email_text", "hs_email_direction", "hs_email_status", "hs_email_from_email", "hs_email_to_email", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.emails.basicApi.getById(emailId, properties || defaultProps);
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, createdAt: response.createdAt, updatedAt: response.updatedAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error getting email engagement: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── List Emails ──
  server.tool(
    "hubspot_list_email_engagements",
    "List email engagements in HubSpot with pagination.",
    {
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional(),
      properties: z.array(z.string()).optional(),
    },
    async ({ limit, after, properties }) => {
      try {
        const defaultProps = ["hs_email_subject", "hs_email_direction", "hs_email_status", "hs_email_from_email", "hs_email_to_email", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.emails.basicApi.getPage(limit, after, properties || defaultProps);
        return {
          content: [{ type: "text", text: JSON.stringify({ results: response.results.map(e => ({ id: e.id, properties: e.properties, createdAt: e.createdAt })), paging: response.paging }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error listing email engagements: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Update Email ──
  server.tool(
    "hubspot_update_email_engagement",
    "Update an email engagement's properties.",
    {
      emailId: z.string().describe("The HubSpot email engagement ID"),
      subject: z.string().optional(),
      body: z.string().optional().describe("Email body (plain text)"),
      html: z.string().optional().describe("Email body (HTML)"),
      direction: z.enum(["EMAIL", "INCOMING_EMAIL", "FORWARDED_EMAIL"]).optional(),
      status: z.enum(["SENT", "FAILED", "SCHEDULED", "DRAFT"]).optional(),
      fromEmail: z.string().optional(),
      toEmail: z.string().optional(),
      timestamp: z.string().optional(),
      ownerId: z.string().optional(),
    },
    async ({ emailId, subject, body, html, direction, status, fromEmail, toEmail, timestamp, ownerId }) => {
      try {
        const properties: Record<string, string> = {};
        if (subject !== undefined) properties.hs_email_subject = subject;
        if (body !== undefined) properties.hs_email_text = body;
        if (html !== undefined) properties.hs_email_html = html;
        if (direction !== undefined) properties.hs_email_direction = direction;
        if (status !== undefined) properties.hs_email_status = status;
        if (fromEmail !== undefined) properties.hs_email_from_email = fromEmail;
        if (toEmail !== undefined) properties.hs_email_to_email = toEmail;
        if (timestamp !== undefined) properties.hs_timestamp = timestamp;
        if (ownerId !== undefined) properties.hubspot_owner_id = ownerId;

        if (Object.keys(properties).length === 0) {
          return { content: [{ type: "text", text: "Error: At least one property must be provided to update." }], isError: true };
        }

        const response = await hubspotClient.crm.objects.emails.basicApi.update(emailId, { properties });
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, updatedAt: response.updatedAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error updating email engagement: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Delete Email ──
  server.tool(
    "hubspot_delete_email_engagement",
    "Archive (soft delete) an email engagement in HubSpot.",
    { emailId: z.string().describe("The HubSpot email engagement ID to archive") },
    async ({ emailId }) => {
      try {
        await hubspotClient.crm.objects.emails.basicApi.archive(emailId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Email engagement ${emailId} archived successfully` }, null, 2) }] };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error archiving email engagement: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Search Emails ──
  server.tool(
    "hubspot_search_email_engagements",
    "Search email engagements in HubSpot.",
    {
      query: z.string().optional(),
      filters: SearchFiltersSchema,
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional(),
      properties: z.array(z.string()).optional(),
    },
    async ({ query, filters, limit, after, properties }) => {
      try {
        const defaultProps = ["hs_email_subject", "hs_email_direction", "hs_email_status", "hs_email_from_email", "hs_email_to_email", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.emails.searchApi.doSearch({
          limit,
          after: after || undefined,
          sorts: [],
          properties: properties || defaultProps,
          filterGroups: filters && filters.length > 0 ? [{ filters }] : [],
          ...(query && { query }),
        } as Parameters<typeof hubspotClient.crm.objects.emails.searchApi.doSearch>[0]);
        return {
          content: [{ type: "text", text: JSON.stringify({ total: response.total, results: response.results.map(e => ({ id: e.id, properties: e.properties, createdAt: e.createdAt })), paging: response.paging }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error searching email engagements: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ─── MEETINGS ──────────────────────────────────────────────────────────────

  // ── Create Meeting ──
  server.tool(
    "hubspot_create_meeting",
    "Create a meeting engagement in HubSpot and optionally associate it with a CRM object.",
    {
      title: z.string().optional().describe("Meeting title"),
      body: z.string().optional().describe("Meeting notes or agenda"),
      startTime: z.string().optional().describe("ISO 8601 meeting start time"),
      endTime: z.string().optional().describe("ISO 8601 meeting end time"),
      outcome: z
        .enum(["COMPLETED", "SCHEDULED", "RESCHEDULED", "NO_SHOW", "CANCELED"])
        .optional()
        .describe("Meeting outcome"),
      location: z.string().optional().describe("Meeting location or URL"),
      timestamp: z.string().optional().describe("ISO 8601 timestamp (defaults to now)"),
      ownerId: z.string().optional().describe("HubSpot owner ID"),
      associateWith: AssociationSchema,
    },
    async ({ title, body, startTime, endTime, outcome, location, timestamp, ownerId, associateWith }) => {
      try {
        const properties: Record<string, string> = {
          hs_timestamp: timestamp || startTime || new Date().toISOString(),
        };
        if (title) properties.hs_meeting_title = title;
        if (body) properties.hs_meeting_body = body;
        if (startTime) properties.hs_meeting_start_time = startTime;
        if (endTime) properties.hs_meeting_end_time = endTime;
        if (outcome) properties.hs_meeting_outcome = outcome;
        if (location) properties.hs_meeting_location = location;
        if (ownerId) properties.hubspot_owner_id = ownerId;

        const response = await hubspotClient.crm.objects.meetings.basicApi.create({
          properties,
          associations: buildAssociations(associateWith, MEETING_ASSOCIATION_TYPES),
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, createdAt: response.createdAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error creating meeting: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Get Meeting ──
  server.tool(
    "hubspot_get_meeting",
    "Get a specific meeting engagement by its ID.",
    {
      meetingId: z.string().describe("The HubSpot meeting ID"),
      properties: z.array(z.string()).optional().describe("Properties to return"),
    },
    async ({ meetingId, properties }) => {
      try {
        const defaultProps = ["hs_meeting_title", "hs_meeting_body", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome", "hs_meeting_location", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.meetings.basicApi.getById(meetingId, properties || defaultProps);
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, createdAt: response.createdAt, updatedAt: response.updatedAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error getting meeting: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── List Meetings ──
  server.tool(
    "hubspot_list_meetings",
    "List meeting engagements in HubSpot with pagination.",
    {
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional(),
      properties: z.array(z.string()).optional(),
    },
    async ({ limit, after, properties }) => {
      try {
        const defaultProps = ["hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome", "hs_meeting_location", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.meetings.basicApi.getPage(limit, after, properties || defaultProps);
        return {
          content: [{ type: "text", text: JSON.stringify({ results: response.results.map(m => ({ id: m.id, properties: m.properties, createdAt: m.createdAt })), paging: response.paging }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error listing meetings: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Update Meeting ──
  server.tool(
    "hubspot_update_meeting",
    "Update a meeting engagement's properties.",
    {
      meetingId: z.string().describe("The HubSpot meeting ID"),
      title: z.string().optional(),
      body: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      outcome: z.enum(["COMPLETED", "SCHEDULED", "RESCHEDULED", "NO_SHOW", "CANCELED"]).optional(),
      location: z.string().optional(),
      timestamp: z.string().optional(),
      ownerId: z.string().optional(),
    },
    async ({ meetingId, title, body, startTime, endTime, outcome, location, timestamp, ownerId }) => {
      try {
        const properties: Record<string, string> = {};
        if (title !== undefined) properties.hs_meeting_title = title;
        if (body !== undefined) properties.hs_meeting_body = body;
        if (startTime !== undefined) properties.hs_meeting_start_time = startTime;
        if (endTime !== undefined) properties.hs_meeting_end_time = endTime;
        if (outcome !== undefined) properties.hs_meeting_outcome = outcome;
        if (location !== undefined) properties.hs_meeting_location = location;
        if (timestamp !== undefined) properties.hs_timestamp = timestamp;
        if (ownerId !== undefined) properties.hubspot_owner_id = ownerId;

        if (Object.keys(properties).length === 0) {
          return { content: [{ type: "text", text: "Error: At least one property must be provided to update." }], isError: true };
        }

        const response = await hubspotClient.crm.objects.meetings.basicApi.update(meetingId, { properties });
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, updatedAt: response.updatedAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error updating meeting: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Delete Meeting ──
  server.tool(
    "hubspot_delete_meeting",
    "Archive (soft delete) a meeting engagement in HubSpot.",
    { meetingId: z.string().describe("The HubSpot meeting ID to archive") },
    async ({ meetingId }) => {
      try {
        await hubspotClient.crm.objects.meetings.basicApi.archive(meetingId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Meeting ${meetingId} archived successfully` }, null, 2) }] };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error archiving meeting: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Search Meetings ──
  server.tool(
    "hubspot_search_meetings",
    "Search meeting engagements in HubSpot.",
    {
      query: z.string().optional(),
      filters: SearchFiltersSchema,
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional(),
      properties: z.array(z.string()).optional(),
    },
    async ({ query, filters, limit, after, properties }) => {
      try {
        const defaultProps = ["hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.meetings.searchApi.doSearch({
          limit,
          after: after || undefined,
          sorts: [],
          properties: properties || defaultProps,
          filterGroups: filters && filters.length > 0 ? [{ filters }] : [],
          ...(query && { query }),
        } as Parameters<typeof hubspotClient.crm.objects.meetings.searchApi.doSearch>[0]);
        return {
          content: [{ type: "text", text: JSON.stringify({ total: response.total, results: response.results.map(m => ({ id: m.id, properties: m.properties, createdAt: m.createdAt })), paging: response.paging }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error searching meetings: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ─── TASKS ─────────────────────────────────────────────────────────────────

  // ── Create Task ──
  server.tool(
    "hubspot_create_task",
    "Create a task in HubSpot and optionally associate it with a CRM object.",
    {
      subject: z.string().describe("Task title/subject"),
      body: z.string().optional().describe("Task notes or description"),
      status: z
        .enum(["NOT_STARTED", "IN_PROGRESS", "WAITING", "DEFERRED", "COMPLETED"])
        .optional()
        .default("NOT_STARTED")
        .describe("Task status"),
      priority: z
        .enum(["LOW", "MEDIUM", "HIGH"])
        .optional()
        .describe("Task priority"),
      type: z
        .enum(["CALL", "EMAIL", "TODO"])
        .optional()
        .describe("Task type"),
      dueDate: z
        .string()
        .optional()
        .describe("ISO 8601 due date/timestamp"),
      ownerId: z.string().optional().describe("HubSpot owner ID"),
      associateWith: AssociationSchema,
    },
    async ({ subject, body, status, priority, type, dueDate, ownerId, associateWith }) => {
      try {
        const properties: Record<string, string> = {
          hs_task_subject: subject,
          hs_timestamp: dueDate || new Date().toISOString(),
        };
        if (body) properties.hs_task_body = body;
        if (status) properties.hs_task_status = status;
        if (priority) properties.hs_task_priority = priority;
        if (type) properties.hs_task_type = type;
        if (ownerId) properties.hubspot_owner_id = ownerId;

        const response = await hubspotClient.crm.objects.tasks.basicApi.create({
          properties,
          associations: buildAssociations(associateWith, TASK_ASSOCIATION_TYPES),
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, createdAt: response.createdAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error creating task: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Get Task ──
  server.tool(
    "hubspot_get_task",
    "Get a specific task by its ID.",
    {
      taskId: z.string().describe("The HubSpot task ID"),
      properties: z.array(z.string()).optional().describe("Properties to return"),
    },
    async ({ taskId, properties }) => {
      try {
        const defaultProps = ["hs_task_subject", "hs_task_body", "hs_task_status", "hs_task_priority", "hs_task_type", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.tasks.basicApi.getById(taskId, properties || defaultProps);
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, createdAt: response.createdAt, updatedAt: response.updatedAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error getting task: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── List Tasks ──
  server.tool(
    "hubspot_list_tasks",
    "List tasks in HubSpot with pagination.",
    {
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional(),
      properties: z.array(z.string()).optional(),
    },
    async ({ limit, after, properties }) => {
      try {
        const defaultProps = ["hs_task_subject", "hs_task_status", "hs_task_priority", "hs_task_type", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.tasks.basicApi.getPage(limit, after, properties || defaultProps);
        return {
          content: [{ type: "text", text: JSON.stringify({ results: response.results.map(t => ({ id: t.id, properties: t.properties, createdAt: t.createdAt })), paging: response.paging }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error listing tasks: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Update Task ──
  server.tool(
    "hubspot_update_task",
    "Update a task's properties.",
    {
      taskId: z.string().describe("The HubSpot task ID"),
      subject: z.string().optional(),
      body: z.string().optional(),
      status: z.enum(["NOT_STARTED", "IN_PROGRESS", "WAITING", "DEFERRED", "COMPLETED"]).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      type: z.enum(["CALL", "EMAIL", "TODO"]).optional(),
      dueDate: z.string().optional().describe("ISO 8601 due date"),
      ownerId: z.string().optional(),
    },
    async ({ taskId, subject, body, status, priority, type, dueDate, ownerId }) => {
      try {
        const properties: Record<string, string> = {};
        if (subject !== undefined) properties.hs_task_subject = subject;
        if (body !== undefined) properties.hs_task_body = body;
        if (status !== undefined) properties.hs_task_status = status;
        if (priority !== undefined) properties.hs_task_priority = priority;
        if (type !== undefined) properties.hs_task_type = type;
        if (dueDate !== undefined) properties.hs_timestamp = dueDate;
        if (ownerId !== undefined) properties.hubspot_owner_id = ownerId;

        if (Object.keys(properties).length === 0) {
          return { content: [{ type: "text", text: "Error: At least one property must be provided to update." }], isError: true };
        }

        const response = await hubspotClient.crm.objects.tasks.basicApi.update(taskId, { properties });
        return {
          content: [{ type: "text", text: JSON.stringify({ id: response.id, properties: response.properties, updatedAt: response.updatedAt }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error updating task: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Delete Task ──
  server.tool(
    "hubspot_delete_task",
    "Archive (soft delete) a task in HubSpot.",
    { taskId: z.string().describe("The HubSpot task ID to archive") },
    async ({ taskId }) => {
      try {
        await hubspotClient.crm.objects.tasks.basicApi.archive(taskId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Task ${taskId} archived successfully` }, null, 2) }] };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error archiving task: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );

  // ── Search Tasks ──
  server.tool(
    "hubspot_search_tasks",
    "Search tasks in HubSpot.",
    {
      query: z.string().optional(),
      filters: SearchFiltersSchema,
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional(),
      properties: z.array(z.string()).optional(),
    },
    async ({ query, filters, limit, after, properties }) => {
      try {
        const defaultProps = ["hs_task_subject", "hs_task_status", "hs_task_priority", "hs_task_type", "hs_timestamp", "hubspot_owner_id"];
        const response = await hubspotClient.crm.objects.tasks.searchApi.doSearch({
          limit,
          after: after || undefined,
          sorts: [],
          properties: properties || defaultProps,
          filterGroups: filters && filters.length > 0 ? [{ filters }] : [],
          ...(query && { query }),
        } as Parameters<typeof hubspotClient.crm.objects.tasks.searchApi.doSearch>[0]);
        return {
          content: [{ type: "text", text: JSON.stringify({ total: response.total, results: response.results.map(t => ({ id: t.id, properties: t.properties, createdAt: t.createdAt })), paging: response.paging }, null, 2) }],
        };
      } catch (error: unknown) {
        return { content: [{ type: "text", text: `Error searching tasks: ${extractHubSpotError(error)}` }], isError: true };
      }
    }
  );
}
