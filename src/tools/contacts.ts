import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import {
  ContactPropertiesSchema,
  FilterSchema,
  convertFiltersToApiFormat,
  extractHubSpotError,
} from "../types.js";

export function registerContactTools(server: McpServer) {
  // Create Contact
  server.tool(
    "hubspot_create_contact",
    "Create a new contact in HubSpot.",
    {
      properties: ContactPropertiesSchema.describe(
        "Contact properties (email, firstname, lastname, phone, company, website, lifecyclestage, jobtitle)"
      ),
    },
    async ({ properties }) => {
      try {
        const response = await hubspotClient.crm.contacts.basicApi.create({
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
              text: `Error creating contact: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Contact
  server.tool(
    "hubspot_get_contact",
    "Get a contact by ID from HubSpot.",
    {
      contactId: z.string().describe("The HubSpot contact ID"),
      properties: z
        .array(z.string())
        .optional()
        .describe("Specific properties to return"),
    },
    async ({ contactId, properties }) => {
      try {
        const response = await hubspotClient.crm.contacts.basicApi.getById(
          contactId,
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
              text: `Error getting contact: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Contacts
  server.tool(
    "hubspot_list_contacts",
    "List contacts from HubSpot with pagination.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(10)
        .describe("Number of contacts to return (max 100)"),
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
        const response = await hubspotClient.crm.contacts.basicApi.getPage(
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
                  results: response.results.map((contact) => ({
                    id: contact.id,
                    properties: contact.properties,
                    createdAt: contact.createdAt,
                    updatedAt: contact.updatedAt,
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
              text: `Error listing contacts: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Search Contacts
  server.tool(
    "hubspot_search_contacts",
    "Search contacts in HubSpot by email, name, or other properties. Supports advanced filtering with multiple operators.",
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
          await hubspotClient.crm.contacts.searchApi.doSearch(
            searchRequest as Parameters<
              typeof hubspotClient.crm.contacts.searchApi.doSearch
            >[0]
          );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: response.total,
                  results: response.results.map((contact) => ({
                    id: contact.id,
                    properties: contact.properties,
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
              text: `Error searching contacts: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Update Contact
  server.tool(
    "hubspot_update_contact",
    "Update a contact's properties in HubSpot.",
    {
      contactId: z.string().describe("The HubSpot contact ID"),
      properties: ContactPropertiesSchema.describe("Properties to update"),
    },
    async ({ contactId, properties }) => {
      try {
        const response = await hubspotClient.crm.contacts.basicApi.update(
          contactId,
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
              text: `Error updating contact: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete (Archive) Contact
  server.tool(
    "hubspot_delete_contact",
    "Archive (soft delete) a contact in HubSpot.",
    {
      contactId: z.string().describe("The HubSpot contact ID to archive"),
    },
    async ({ contactId }) => {
      try {
        await hubspotClient.crm.contacts.basicApi.archive(contactId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Contact ${contactId} archived successfully`,
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
              text: `Error archiving contact: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch Create Contacts
  server.tool(
    "hubspot_batch_create_contacts",
    "Create multiple contacts at once (max 100).",
    {
      contacts: z
        .array(ContactPropertiesSchema)
        .min(1)
        .max(100)
        .describe("Array of contact properties to create"),
    },
    async ({ contacts }) => {
      try {
        const response = await hubspotClient.crm.contacts.batchApi.create({
          inputs: contacts.map((properties) => ({ properties, associations: [] })),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.status,
                  results: response.results.map((contact) => ({
                    id: contact.id,
                    properties: contact.properties,
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
              text: `Error batch creating contacts: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch Update Contacts
  server.tool(
    "hubspot_batch_update_contacts",
    "Update multiple contacts at once (max 100).",
    {
      contacts: z
        .array(
          z.object({
            id: z.string().describe("Contact ID"),
            properties: ContactPropertiesSchema,
          })
        )
        .min(1)
        .max(100)
        .describe("Array of contact updates with IDs and properties"),
    },
    async ({ contacts }) => {
      try {
        const response = await hubspotClient.crm.contacts.batchApi.update({
          inputs: contacts.map(({ id, properties }) => ({ id, properties })),
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: response.status,
                  results: response.results.map((contact) => ({
                    id: contact.id,
                    properties: contact.properties,
                    updatedAt: contact.updatedAt,
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
              text: `Error batch updating contacts: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
