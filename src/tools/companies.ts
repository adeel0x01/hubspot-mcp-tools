import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import {
  CompanyPropertiesSchema,
  FilterSchema,
  convertFiltersToApiFormat,
  extractHubSpotError,
} from "../types.js";

export function registerCompanyTools(server: McpServer) {
  // Create Company
  server.tool(
    "hubspot_create_company",
    "Create a new company in HubSpot.",
    {
      properties: CompanyPropertiesSchema.describe(
        "Company properties (name, domain, description, phone, industry, numberofemployees, annualrevenue, city, state, country)"
      ),
    },
    async ({ properties }) => {
      try {
        const response = await hubspotClient.crm.companies.basicApi.create({
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
              text: `Error creating company: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Company
  server.tool(
    "hubspot_get_company",
    "Get a company by ID from HubSpot.",
    {
      companyId: z.string().describe("The HubSpot company ID"),
      properties: z
        .array(z.string())
        .optional()
        .describe("Specific properties to return"),
    },
    async ({ companyId, properties }) => {
      try {
        const response = await hubspotClient.crm.companies.basicApi.getById(
          companyId,
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
              text: `Error getting company: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Companies
  server.tool(
    "hubspot_list_companies",
    "List companies from HubSpot with pagination.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(10)
        .describe("Number of companies to return (max 100)"),
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
        const response = await hubspotClient.crm.companies.basicApi.getPage(
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
                  results: response.results.map((company) => ({
                    id: company.id,
                    properties: company.properties,
                    createdAt: company.createdAt,
                    updatedAt: company.updatedAt,
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
              text: `Error listing companies: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Search Companies
  server.tool(
    "hubspot_search_companies",
    "Search companies in HubSpot by name, domain, or other properties. Supports advanced filtering with multiple operators.",
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

        const response =
          await hubspotClient.crm.companies.searchApi.doSearch(
            searchRequest as Parameters<
              typeof hubspotClient.crm.companies.searchApi.doSearch
            >[0]
          );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: response.total,
                  results: response.results.map((company) => ({
                    id: company.id,
                    properties: company.properties,
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
              text: `Error searching companies: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Update Company
  server.tool(
    "hubspot_update_company",
    "Update a company's properties in HubSpot.",
    {
      companyId: z.string().describe("The HubSpot company ID"),
      properties: CompanyPropertiesSchema.describe("Properties to update"),
    },
    async ({ companyId, properties }) => {
      try {
        const response = await hubspotClient.crm.companies.basicApi.update(
          companyId,
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
              text: `Error updating company: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete (Archive) Company
  server.tool(
    "hubspot_delete_company",
    "Archive (soft delete) a company in HubSpot.",
    {
      companyId: z.string().describe("The HubSpot company ID to archive"),
    },
    async ({ companyId }) => {
      try {
        await hubspotClient.crm.companies.basicApi.archive(companyId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Company ${companyId} archived successfully`,
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
              text: `Error archiving company: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch Create Companies
  server.tool(
    "hubspot_batch_create_companies",
    "Create multiple companies at once (max 100).",
    {
      companies: z
        .array(CompanyPropertiesSchema)
        .min(1)
        .max(100)
        .describe("Array of company properties to create"),
    },
    async ({ companies }) => {
      try {
        const response = await hubspotClient.crm.companies.batchApi.create({
          inputs: companies.map((properties) => ({
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
                  results: response.results.map((company) => ({
                    id: company.id,
                    properties: company.properties,
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
              text: `Error batch creating companies: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch Update Companies
  server.tool(
    "hubspot_batch_update_companies",
    "Update multiple companies at once (max 100).",
    {
      companies: z
        .array(
          z.object({
            id: z.string().describe("Company ID"),
            properties: CompanyPropertiesSchema,
          })
        )
        .min(1)
        .max(100)
        .describe("Array of company updates with IDs and properties"),
    },
    async ({ companies }) => {
      try {
        const response = await hubspotClient.crm.companies.batchApi.update({
          inputs: companies.map(({ id, properties }) => ({ id, properties })),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.status,
                  results: response.results.map((company) => ({
                    id: company.id,
                    properties: company.properties,
                    updatedAt: company.updatedAt,
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
              text: `Error batch updating companies: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
