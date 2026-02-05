import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import {
  TicketPropertiesSchema,
  FilterSchema,
  convertFiltersToApiFormat,
  extractHubSpotError,
} from "../types.js";

export function registerTicketTools(server: McpServer) {
  // Create Ticket
  server.tool(
    "hubspot_create_ticket",
    "Create a new ticket in HubSpot. Use hubspot_get_pipelines with objectType='tickets' to see available pipelines and stages.",
    {
      properties: TicketPropertiesSchema.describe(
        "Ticket properties (subject, content, hs_pipeline, hs_pipeline_stage, hs_ticket_priority, hubspot_owner_id)"
      ),
    },
    async ({ properties }) => {
      try {
        const response = await hubspotClient.crm.tickets.basicApi.create({
          properties,
          associations: [],
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: response.id,
                  properties: response.properties,
                  createdAt: response.createdAt,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating ticket: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Ticket
  server.tool(
    "hubspot_get_ticket",
    "Get a ticket by ID from HubSpot.",
    {
      ticketId: z.string().describe("The HubSpot ticket ID"),
      properties: z
        .array(z.string())
        .optional()
        .describe("Specific properties to return"),
    },
    async ({ ticketId, properties }) => {
      try {
        const response = await hubspotClient.crm.tickets.basicApi.getById(
          ticketId,
          properties
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: response.id,
                  properties: response.properties,
                  createdAt: response.createdAt,
                  updatedAt: response.updatedAt,
                  archived: response.archived,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting ticket: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Tickets
  server.tool(
    "hubspot_list_tickets",
    "List tickets from HubSpot with pagination.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(10)
        .describe("Number of tickets to return (max 100)"),
      after: z
        .string()
        .optional()
        .describe("Pagination cursor for next page"),
      properties: z
        .array(z.string())
        .optional()
        .describe("Specific properties to return"),
    },
    async ({ limit, after, properties }) => {
      try {
        const response = await hubspotClient.crm.tickets.basicApi.getPage(
          limit,
          after,
          properties
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  results: response.results.map((ticket) => ({
                    id: ticket.id,
                    properties: ticket.properties,
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                  })),
                  paging: response.paging,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing tickets: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Search Tickets
  server.tool(
    "hubspot_search_tickets",
    "Search tickets in HubSpot by subject, status, or other properties. Supports advanced filtering with multiple operators.",
    {
      query: z.string().optional().describe("Full-text search query"),
      filters: z
        .array(FilterSchema)
        .optional()
        .describe(
          "Filter criteria. Operators: EQ, NEQ, LT, LTE, GT, GTE, BETWEEN (use value+highValue), IN/NOT_IN (use values array), HAS_PROPERTY, NOT_HAS_PROPERTY, CONTAINS_TOKEN, NOT_CONTAINS_TOKEN"
        ),
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional().describe("Pagination cursor"),
      sorts: z
        .array(z.string())
        .optional()
        .describe(
          "Properties to sort by. Prefix with - for descending (e.g., '-createdate')"
        ),
      properties: z.array(z.string()).optional(),
    },
    async ({ query, filters, limit, after, sorts, properties }) => {
      try {
        const searchRequest = {
          limit,
          after: after || undefined,
          sorts: sorts || [],
          properties: properties || [],
          filterGroups:
            filters && filters.length > 0
              ? [{ filters: convertFiltersToApiFormat(filters) }]
              : [],
          ...(query && { query }),
        };

        const response = await hubspotClient.crm.tickets.searchApi.doSearch(
          searchRequest as Parameters<
            typeof hubspotClient.crm.tickets.searchApi.doSearch
          >[0]
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: response.total,
                  results: response.results.map((ticket) => ({
                    id: ticket.id,
                    properties: ticket.properties,
                  })),
                  paging: response.paging,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching tickets: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Update Ticket
  server.tool(
    "hubspot_update_ticket",
    "Update a ticket's properties in HubSpot.",
    {
      ticketId: z.string().describe("The HubSpot ticket ID"),
      properties: TicketPropertiesSchema.describe("Properties to update"),
    },
    async ({ ticketId, properties }) => {
      try {
        const response = await hubspotClient.crm.tickets.basicApi.update(
          ticketId,
          { properties }
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: response.id,
                  properties: response.properties,
                  updatedAt: response.updatedAt,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating ticket: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete (Archive) Ticket
  server.tool(
    "hubspot_delete_ticket",
    "Archive (soft delete) a ticket in HubSpot.",
    {
      ticketId: z.string().describe("The HubSpot ticket ID to archive"),
    },
    async ({ ticketId }) => {
      try {
        await hubspotClient.crm.tickets.basicApi.archive(ticketId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Ticket ${ticketId} archived successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error archiving ticket: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch Create Tickets
  server.tool(
    "hubspot_batch_create_tickets",
    "Create multiple tickets at once (max 100).",
    {
      tickets: z
        .array(TicketPropertiesSchema)
        .min(1)
        .max(100)
        .describe("Array of ticket properties to create"),
    },
    async ({ tickets }) => {
      try {
        const response = await hubspotClient.crm.tickets.batchApi.create({
          inputs: tickets.map((properties) => ({
            properties,
            associations: [],
          })),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.status,
                  results: response.results.map((ticket) => ({
                    id: ticket.id,
                    properties: ticket.properties,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error batch creating tickets: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch Update Tickets
  server.tool(
    "hubspot_batch_update_tickets",
    "Update multiple tickets at once (max 100).",
    {
      tickets: z
        .array(
          z.object({
            id: z.string().describe("Ticket ID"),
            properties: TicketPropertiesSchema,
          })
        )
        .min(1)
        .max(100)
        .describe("Array of ticket updates with IDs and properties"),
    },
    async ({ tickets }) => {
      try {
        const response = await hubspotClient.crm.tickets.batchApi.update({
          inputs: tickets.map(({ id, properties }) => ({ id, properties })),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.status,
                  results: response.results.map((ticket) => ({
                    id: ticket.id,
                    properties: ticket.properties,
                    updatedAt: ticket.updatedAt,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error batch updating tickets: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
