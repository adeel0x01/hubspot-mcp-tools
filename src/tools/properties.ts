import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import { CrmObjectTypeSchema, extractHubSpotError } from "../types.js";

export function registerPropertyTools(server: McpServer) {
  // Get all properties for an object type
  server.tool(
    "hubspot_get_properties",
    "Get all available properties for a HubSpot object type. Use this to discover what fields can be used when creating, updating, or searching objects.",
    {
      objectType: CrmObjectTypeSchema.describe(
        "The object type to get properties for (contacts, companies, deals, tickets)"
      ),
      archived: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include archived properties"),
    },
    async ({ objectType, archived }) => {
      try {
        const response = await hubspotClient.crm.properties.coreApi.getAll(
          objectType,
          archived
        );

        const properties = response.results.map((prop) => ({
          name: prop.name,
          label: prop.label,
          type: prop.type,
          fieldType: prop.fieldType,
          description: prop.description,
          groupName: prop.groupName,
          options: prop.options?.map((opt) => ({
            label: opt.label,
            value: opt.value,
            description: opt.description,
          })),
          hasUniqueValue: prop.hasUniqueValue,
          hidden: prop.hidden,
          modificationMetadata: prop.modificationMetadata,
          formField: prop.formField,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  objectType,
                  total: properties.length,
                  properties,
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
              text: `Error getting properties: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get a specific property by name
  server.tool(
    "hubspot_get_property",
    "Get detailed information about a specific property including its options, validation rules, and metadata.",
    {
      objectType: CrmObjectTypeSchema.describe(
        "The object type the property belongs to"
      ),
      propertyName: z.string().describe("The internal name of the property"),
      archived: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include if property is archived"),
    },
    async ({ objectType, propertyName, archived }) => {
      try {
        const property = await hubspotClient.crm.properties.coreApi.getByName(
          objectType,
          propertyName,
          archived
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  name: property.name,
                  label: property.label,
                  type: property.type,
                  fieldType: property.fieldType,
                  description: property.description,
                  groupName: property.groupName,
                  options: property.options?.map((opt) => ({
                    label: opt.label,
                    value: opt.value,
                    description: opt.description,
                    displayOrder: opt.displayOrder,
                    hidden: opt.hidden,
                  })),
                  displayOrder: property.displayOrder,
                  hasUniqueValue: property.hasUniqueValue,
                  hidden: property.hidden,
                  modificationMetadata: property.modificationMetadata,
                  formField: property.formField,
                  calculationFormula: property.calculationFormula,
                  externalOptions: property.externalOptions,
                  referencedObjectType: property.referencedObjectType,
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
              text: `Error getting property: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get property groups
  server.tool(
    "hubspot_get_property_groups",
    "Get all property groups for a HubSpot object type. Property groups organize properties into logical sections.",
    {
      objectType: CrmObjectTypeSchema.describe(
        "The object type to get property groups for"
      ),
    },
    async ({ objectType }) => {
      try {
        const response = await hubspotClient.crm.properties.groupsApi.getAll(
          objectType
        );

        const groups = response.results.map((group) => ({
          name: group.name,
          label: group.label,
          displayOrder: group.displayOrder,
          archived: group.archived,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  objectType,
                  total: groups.length,
                  groups,
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
              text: `Error getting property groups: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
