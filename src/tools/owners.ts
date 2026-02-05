import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import { extractHubSpotError } from "../types.js";

export function registerOwnerTools(server: McpServer) {
  // List all owners
  server.tool(
    "hubspot_list_owners",
    "List all HubSpot owners (users) in the account. Use this to find owner IDs for assigning contacts, companies, deals, or tickets.",
    {
      email: z
        .string()
        .optional()
        .describe("Filter owners by email address"),
      limit: z
        .number()
        .min(1)
        .max(500)
        .default(100)
        .describe("Number of owners to return (max 500)"),
      after: z
        .string()
        .optional()
        .describe("Pagination cursor for next page"),
      archived: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include archived/deactivated owners"),
    },
    async ({ email, limit, after, archived }) => {
      try {
        const response = await hubspotClient.crm.owners.ownersApi.getPage(
          email,
          after,
          limit,
          archived
        );

        const owners = response.results.map((owner) => ({
          id: owner.id,
          email: owner.email,
          firstName: owner.firstName,
          lastName: owner.lastName,
          userId: owner.userId,
          teams: owner.teams?.map((team) => ({
            id: team.id,
            name: team.name,
            primary: team.primary,
          })),
          archived: owner.archived,
          createdAt: owner.createdAt,
          updatedAt: owner.updatedAt,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: owners.length,
                  results: owners,
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
              text: `Error listing owners: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get a specific owner by ID
  server.tool(
    "hubspot_get_owner",
    "Get detailed information about a specific HubSpot owner by their ID.",
    {
      ownerId: z.number().describe("The owner ID (numeric)"),
      idProperty: z
        .enum(["id", "userId"])
        .optional()
        .default("id")
        .describe("The property to use for lookup (id or userId)"),
      archived: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include if owner is archived"),
    },
    async ({ ownerId, idProperty, archived }) => {
      try {
        const owner = await hubspotClient.crm.owners.ownersApi.getById(
          ownerId,
          idProperty,
          archived
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: owner.id,
                  email: owner.email,
                  firstName: owner.firstName,
                  lastName: owner.lastName,
                  userId: owner.userId,
                  teams: owner.teams?.map((team) => ({
                    id: team.id,
                    name: team.name,
                    primary: team.primary,
                  })),
                  archived: owner.archived,
                  createdAt: owner.createdAt,
                  updatedAt: owner.updatedAt,
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
              text: `Error getting owner: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
