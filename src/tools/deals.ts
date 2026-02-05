import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import {
  DealPropertiesSchema,
  FilterSchema,
  convertFiltersToApiFormat,
  extractHubSpotError,
} from "../types.js";

export function registerDealTools(server: McpServer) {
  // Create Deal
  server.tool(
    "hubspot_create_deal",
    "Create a new deal in HubSpot. Use hubspot_get_pipelines to see available pipelines and stages.",
    {
      properties: DealPropertiesSchema.describe(
        "Deal properties (dealname, amount, dealstage, pipeline, closedate, hubspot_owner_id, description)"
      ),
    },
    async ({ properties }) => {
      try {
        const response = await hubspotClient.crm.deals.basicApi.create({
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
              text: `Error creating deal: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Deal
  server.tool(
    "hubspot_get_deal",
    "Get a deal by ID from HubSpot.",
    {
      dealId: z.string().describe("The HubSpot deal ID"),
      properties: z
        .array(z.string())
        .optional()
        .describe("Specific properties to return"),
    },
    async ({ dealId, properties }) => {
      try {
        const response = await hubspotClient.crm.deals.basicApi.getById(
          dealId,
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
              text: `Error getting deal: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Deals
  server.tool(
    "hubspot_list_deals",
    "List deals from HubSpot with pagination.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(10)
        .describe("Number of deals to return (max 100)"),
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
        const response = await hubspotClient.crm.deals.basicApi.getPage(
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
                  results: response.results.map((deal) => ({
                    id: deal.id,
                    properties: deal.properties,
                    createdAt: deal.createdAt,
                    updatedAt: deal.updatedAt,
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
              text: `Error listing deals: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Search Deals
  server.tool(
    "hubspot_search_deals",
    "Search deals in HubSpot by name, stage, amount, or other properties. Supports advanced filtering with multiple operators.",
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
          "Properties to sort by. Prefix with - for descending (e.g., '-amount')"
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

        const response = await hubspotClient.crm.deals.searchApi.doSearch(
          searchRequest as Parameters<
            typeof hubspotClient.crm.deals.searchApi.doSearch
          >[0]
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: response.total,
                  results: response.results.map((deal) => ({
                    id: deal.id,
                    properties: deal.properties,
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
              text: `Error searching deals: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Update Deal
  server.tool(
    "hubspot_update_deal",
    "Update a deal's properties in HubSpot.",
    {
      dealId: z.string().describe("The HubSpot deal ID"),
      properties: DealPropertiesSchema.describe("Properties to update"),
    },
    async ({ dealId, properties }) => {
      try {
        const response = await hubspotClient.crm.deals.basicApi.update(dealId, {
          properties,
        });
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
              text: `Error updating deal: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete (Archive) Deal
  server.tool(
    "hubspot_delete_deal",
    "Archive (soft delete) a deal in HubSpot.",
    {
      dealId: z.string().describe("The HubSpot deal ID to archive"),
    },
    async ({ dealId }) => {
      try {
        await hubspotClient.crm.deals.basicApi.archive(dealId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Deal ${dealId} archived successfully`,
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
              text: `Error archiving deal: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch Create Deals
  server.tool(
    "hubspot_batch_create_deals",
    "Create multiple deals at once (max 100).",
    {
      deals: z
        .array(DealPropertiesSchema)
        .min(1)
        .max(100)
        .describe("Array of deal properties to create"),
    },
    async ({ deals }) => {
      try {
        const response = await hubspotClient.crm.deals.batchApi.create({
          inputs: deals.map((properties) => ({ properties, associations: [] })),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.status,
                  results: response.results.map((deal) => ({
                    id: deal.id,
                    properties: deal.properties,
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
              text: `Error batch creating deals: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch Update Deals
  server.tool(
    "hubspot_batch_update_deals",
    "Update multiple deals at once (max 100).",
    {
      deals: z
        .array(
          z.object({
            id: z.string().describe("Deal ID"),
            properties: DealPropertiesSchema,
          })
        )
        .min(1)
        .max(100)
        .describe("Array of deal updates with IDs and properties"),
    },
    async ({ deals }) => {
      try {
        const response = await hubspotClient.crm.deals.batchApi.update({
          inputs: deals.map(({ id, properties }) => ({ id, properties })),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.status,
                  results: response.results.map((deal) => ({
                    id: deal.id,
                    properties: deal.properties,
                    updatedAt: deal.updatedAt,
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
              text: `Error batch updating deals: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
