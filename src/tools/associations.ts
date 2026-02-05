import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import { CrmObjectTypeSchema, AssociationCategorySchema, extractHubSpotError } from "../types.js";
import { AssociationSpecAssociationCategoryEnum } from "@hubspot/api-client/lib/codegen/crm/associations/v4/models/AssociationSpec.js";

// Default association type IDs for HubSpot-defined associations
// These are the most common primary association types
const DEFAULT_ASSOCIATION_TYPES: Record<string, Record<string, number>> = {
  contacts: {
    companies: 1,
    deals: 3,
    tickets: 15,
  },
  companies: {
    contacts: 2,
    deals: 5,
    tickets: 25,
  },
  deals: {
    contacts: 4,
    companies: 6,
    tickets: 27,
  },
  tickets: {
    contacts: 16,
    companies: 26,
    deals: 28,
  },
};

// Map our category enum to HubSpot's enum
function mapAssociationCategory(
  category: "HUBSPOT_DEFINED" | "USER_DEFINED" | "INTEGRATOR_DEFINED"
): AssociationSpecAssociationCategoryEnum {
  switch (category) {
    case "HUBSPOT_DEFINED":
      return AssociationSpecAssociationCategoryEnum.HubspotDefined;
    case "USER_DEFINED":
      return AssociationSpecAssociationCategoryEnum.UserDefined;
    case "INTEGRATOR_DEFINED":
      return AssociationSpecAssociationCategoryEnum.IntegratorDefined;
    default:
      return AssociationSpecAssociationCategoryEnum.HubspotDefined;
  }
}

export function registerAssociationTools(server: McpServer) {
  // Get association types between two object types
  server.tool(
    "hubspot_get_association_types",
    "Get all available association types between two HubSpot object types. Use this to discover valid associationTypeId values for creating associations.",
    {
      fromObjectType: CrmObjectTypeSchema.describe(
        "The type of the source object"
      ),
      toObjectType: CrmObjectTypeSchema.describe(
        "The type of the target object"
      ),
    },
    async ({ fromObjectType, toObjectType }) => {
      try {
        const response =
          await hubspotClient.crm.associations.schema.typesApi.getAll(
            fromObjectType,
            toObjectType
          );

        // PublicAssociationDefinition has 'id' and 'name' properties
        const types = response.results.map((type) => ({
          id: type.id,
          name: type.name,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  fromObjectType,
                  toObjectType,
                  total: types.length,
                  types,
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
              text: `Error getting association types: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Create Association
  server.tool(
    "hubspot_create_association",
    "Create an association between two HubSpot objects. Use hubspot_get_association_types to discover valid association type IDs.",
    {
      fromObjectType: CrmObjectTypeSchema.describe(
        "The type of the source object"
      ),
      fromObjectId: z.string().describe("The ID of the source object"),
      toObjectType: CrmObjectTypeSchema.describe(
        "The type of the target object"
      ),
      toObjectId: z.string().describe("The ID of the target object"),
      associationTypeId: z
        .number()
        .optional()
        .describe(
          "The association type ID. Use hubspot_get_association_types to find valid IDs. If not provided, uses default HubSpot-defined type."
        ),
      associationCategory: AssociationCategorySchema.optional()
        .default("HUBSPOT_DEFINED")
        .describe(
          "The association category: HUBSPOT_DEFINED (standard), USER_DEFINED (custom labels), or INTEGRATOR_DEFINED"
        ),
    },
    async ({
      fromObjectType,
      fromObjectId,
      toObjectType,
      toObjectId,
      associationTypeId,
      associationCategory,
    }) => {
      try {
        // Get association type ID
        let typeId = associationTypeId;
        let category = associationCategory || "HUBSPOT_DEFINED";

        if (!typeId) {
          const defaultTypes = DEFAULT_ASSOCIATION_TYPES[fromObjectType];
          if (defaultTypes && defaultTypes[toObjectType]) {
            typeId = defaultTypes[toObjectType];
            category = "HUBSPOT_DEFINED";
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: No default association type found for ${fromObjectType} -> ${toObjectType}. Please provide associationTypeId. Use hubspot_get_association_types to discover valid types.`,
                },
              ],
              isError: true,
            };
          }
        }

        await hubspotClient.crm.associations.v4.basicApi.create(
          fromObjectType,
          fromObjectId,
          toObjectType,
          toObjectId,
          [
            {
              associationCategory: mapAssociationCategory(category),
              associationTypeId: typeId,
            },
          ]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Association created: ${fromObjectType}/${fromObjectId} -> ${toObjectType}/${toObjectId}`,
                  associationTypeId: typeId,
                  associationCategory: category,
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
              text: `Error creating association: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Associations
  server.tool(
    "hubspot_get_associations",
    "Get all associations for a HubSpot object to another object type.",
    {
      fromObjectType: CrmObjectTypeSchema.describe(
        "The type of the source object"
      ),
      fromObjectId: z.string().describe("The ID of the source object"),
      toObjectType: CrmObjectTypeSchema.describe(
        "The type of objects to get associations for"
      ),
      limit: z.number().min(1).max(500).default(100),
      after: z.string().optional().describe("Pagination cursor"),
    },
    async ({ fromObjectType, fromObjectId, toObjectType, limit, after }) => {
      try {
        const response =
          await hubspotClient.crm.associations.v4.basicApi.getPage(
            fromObjectType,
            fromObjectId,
            toObjectType,
            after,
            limit
          );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  fromObjectType,
                  fromObjectId,
                  toObjectType,
                  total: response.results.length,
                  associations: response.results.map((assoc) => ({
                    toObjectId: assoc.toObjectId,
                    associationTypes: assoc.associationTypes,
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
              text: `Error getting associations: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete Association
  server.tool(
    "hubspot_delete_association",
    "Remove an association between two HubSpot objects.",
    {
      fromObjectType: CrmObjectTypeSchema.describe(
        "The type of the source object"
      ),
      fromObjectId: z.string().describe("The ID of the source object"),
      toObjectType: CrmObjectTypeSchema.describe(
        "The type of the target object"
      ),
      toObjectId: z.string().describe("The ID of the target object"),
    },
    async ({ fromObjectType, fromObjectId, toObjectType, toObjectId }) => {
      try {
        await hubspotClient.crm.associations.v4.basicApi.archive(
          fromObjectType,
          fromObjectId,
          toObjectType,
          toObjectId
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Association removed: ${fromObjectType}/${fromObjectId} -> ${toObjectType}/${toObjectId}`,
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
              text: `Error deleting association: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Batch create associations
  server.tool(
    "hubspot_batch_create_associations",
    "Create multiple associations at once between objects of the same types.",
    {
      fromObjectType: CrmObjectTypeSchema.describe(
        "The type of the source objects"
      ),
      toObjectType: CrmObjectTypeSchema.describe(
        "The type of the target objects"
      ),
      associations: z
        .array(
          z.object({
            fromObjectId: z.string().describe("Source object ID"),
            toObjectId: z.string().describe("Target object ID"),
          })
        )
        .min(1)
        .max(100)
        .describe("Array of associations to create (max 100)"),
      associationTypeId: z
        .number()
        .optional()
        .describe("The association type ID to use for all associations"),
      associationCategory: AssociationCategorySchema.optional().default(
        "HUBSPOT_DEFINED"
      ),
    },
    async ({
      fromObjectType,
      toObjectType,
      associations,
      associationTypeId,
      associationCategory,
    }) => {
      try {
        // Get association type ID
        let typeId = associationTypeId;
        let category = associationCategory || "HUBSPOT_DEFINED";

        if (!typeId) {
          const defaultTypes = DEFAULT_ASSOCIATION_TYPES[fromObjectType];
          if (defaultTypes && defaultTypes[toObjectType]) {
            typeId = defaultTypes[toObjectType];
            category = "HUBSPOT_DEFINED";
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: No default association type found for ${fromObjectType} -> ${toObjectType}. Please provide associationTypeId.`,
                },
              ],
              isError: true,
            };
          }
        }

        const inputs = associations.map((assoc) => ({
          _from: { id: assoc.fromObjectId },
          to: { id: assoc.toObjectId },
          types: [
            {
              associationCategory: mapAssociationCategory(category),
              associationTypeId: typeId,
            },
          ],
        }));

        const response =
          await hubspotClient.crm.associations.v4.batchApi.create(
            fromObjectType,
            toObjectType,
            { inputs }
          );

        // LabelsBetweenObjectPair has fromObjectId and toObjectId properties
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  created: response.results.length,
                  results: response.results.map((r) => ({
                    fromObjectId: r.fromObjectId,
                    toObjectId: r.toObjectId,
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
              text: `Error batch creating associations: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
