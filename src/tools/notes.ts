import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import { CrmObjectTypeSchema, extractHubSpotError } from "../types.js";
import { AssociationSpecAssociationCategoryEnum } from "@hubspot/api-client/lib/codegen/crm/associations/v4/models/AssociationSpec.js";

// Association type IDs for notes to other objects
const NOTE_ASSOCIATION_TYPES: Record<string, number> = {
  contacts: 202,
  companies: 190,
  deals: 214,
  tickets: 226,
};

export function registerNoteTools(server: McpServer) {
  // Create Note
  server.tool(
    "hubspot_create_note",
    "Create a note and optionally associate it with a HubSpot object (contact, company, deal, or ticket).",
    {
      body: z.string().describe("The note content/body text"),
      timestamp: z
        .string()
        .optional()
        .describe("ISO 8601 timestamp for the note (defaults to now)"),
      ownerId: z
        .string()
        .optional()
        .describe("Owner ID to assign the note to"),
      associateWith: z
        .object({
          objectType: CrmObjectTypeSchema,
          objectId: z.string(),
        })
        .optional()
        .describe("Object to associate the note with"),
    },
    async ({ body, timestamp, ownerId, associateWith }) => {
      try {
        const properties: Record<string, string> = {
          hs_note_body: body,
          hs_timestamp: timestamp || new Date().toISOString(),
        };

        if (ownerId) {
          properties.hubspot_owner_id = ownerId;
        }

        const associations: {
          to: { id: string };
          types: {
            associationCategory: AssociationSpecAssociationCategoryEnum;
            associationTypeId: number;
          }[];
        }[] = [];

        if (associateWith) {
          const associationTypeId =
            NOTE_ASSOCIATION_TYPES[associateWith.objectType];
          if (associationTypeId) {
            associations.push({
              to: { id: associateWith.objectId },
              types: [
                {
                  associationCategory:
                    AssociationSpecAssociationCategoryEnum.HubspotDefined,
                  associationTypeId,
                },
              ],
            });
          }
        }

        const response = await hubspotClient.crm.objects.notes.basicApi.create({
          properties,
          associations,
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
            { type: "text", text: `Error creating note: ${extractHubSpotError(error)}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Get a specific note by ID
  server.tool(
    "hubspot_get_note",
    "Get a specific note by its ID.",
    {
      noteId: z.string().describe("The HubSpot note ID"),
      properties: z
        .array(z.string())
        .optional()
        .describe("Specific properties to return"),
    },
    async ({ noteId, properties }) => {
      try {
        const defaultProps = [
          "hs_note_body",
          "hs_timestamp",
          "hubspot_owner_id",
        ];
        const response = await hubspotClient.crm.objects.notes.basicApi.getById(
          noteId,
          properties || defaultProps
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: response.id,
                  body: response.properties.hs_note_body,
                  timestamp: response.properties.hs_timestamp,
                  ownerId: response.properties.hubspot_owner_id,
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
            { type: "text", text: `Error getting note: ${extractHubSpotError(error)}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Notes for Object
  server.tool(
    "hubspot_get_object_notes",
    "Get notes associated with a HubSpot object (contact, company, deal, or ticket).",
    {
      objectType: CrmObjectTypeSchema.describe(
        "The type of object to get notes for"
      ),
      objectId: z.string().describe("The HubSpot object ID"),
      limit: z.number().min(1).max(100).default(10),
    },
    async ({ objectType, objectId, limit }) => {
      try {
        // Get associations from the object to notes
        const associations =
          await hubspotClient.crm.associations.v4.basicApi.getPage(
            objectType,
            objectId,
            "notes",
            undefined,
            limit
          );

        if (!associations.results || associations.results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ notes: [], total: 0 }, null, 2),
              },
            ],
          };
        }

        // Get the actual note objects
        const noteIds = associations.results.map((assoc) => assoc.toObjectId);
        const notes = await hubspotClient.crm.objects.notes.batchApi.read({
          inputs: noteIds.map((id) => ({ id })),
          properties: ["hs_note_body", "hs_timestamp", "hubspot_owner_id"],
          propertiesWithHistory: [],
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  objectType,
                  objectId,
                  notes: notes.results.map((note) => ({
                    id: note.id,
                    body: note.properties.hs_note_body,
                    timestamp: note.properties.hs_timestamp,
                    ownerId: note.properties.hubspot_owner_id,
                    createdAt: note.createdAt,
                  })),
                  total: notes.results.length,
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
            { type: "text", text: `Error getting notes: ${extractHubSpotError(error)}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List all notes with pagination
  server.tool(
    "hubspot_list_notes",
    "List all notes in HubSpot with pagination.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(10)
        .describe("Number of notes to return (max 100)"),
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
        const defaultProps = [
          "hs_note_body",
          "hs_timestamp",
          "hubspot_owner_id",
        ];
        const response = await hubspotClient.crm.objects.notes.basicApi.getPage(
          limit,
          after,
          properties || defaultProps
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  results: response.results.map((note) => ({
                    id: note.id,
                    body: note.properties.hs_note_body,
                    timestamp: note.properties.hs_timestamp,
                    ownerId: note.properties.hubspot_owner_id,
                    createdAt: note.createdAt,
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
            { type: "text", text: `Error listing notes: ${extractHubSpotError(error)}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update Note
  server.tool(
    "hubspot_update_note",
    "Update a note's content or properties.",
    {
      noteId: z.string().describe("The HubSpot note ID"),
      body: z.string().optional().describe("New note content"),
      timestamp: z
        .string()
        .optional()
        .describe("New ISO 8601 timestamp for the note"),
      ownerId: z
        .string()
        .optional()
        .describe("New owner ID for the note"),
    },
    async ({ noteId, body, timestamp, ownerId }) => {
      try {
        const properties: Record<string, string> = {};

        if (body !== undefined) {
          properties.hs_note_body = body;
        }
        if (timestamp !== undefined) {
          properties.hs_timestamp = timestamp;
        }
        if (ownerId !== undefined) {
          properties.hubspot_owner_id = ownerId;
        }

        if (Object.keys(properties).length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Error: At least one property (body, timestamp, or ownerId) must be provided to update.",
              },
            ],
            isError: true,
          };
        }

        const response = await hubspotClient.crm.objects.notes.basicApi.update(
          noteId,
          { properties }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: response.id,
                  body: response.properties.hs_note_body,
                  timestamp: response.properties.hs_timestamp,
                  ownerId: response.properties.hubspot_owner_id,
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
            { type: "text", text: `Error updating note: ${extractHubSpotError(error)}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete (Archive) Note
  server.tool(
    "hubspot_delete_note",
    "Archive (soft delete) a note in HubSpot.",
    {
      noteId: z.string().describe("The HubSpot note ID to archive"),
    },
    async ({ noteId }) => {
      try {
        await hubspotClient.crm.objects.notes.basicApi.archive(noteId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Note ${noteId} archived successfully`,
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
            { type: "text", text: `Error archiving note: ${extractHubSpotError(error)}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Search Notes
  server.tool(
    "hubspot_search_notes",
    "Search notes in HubSpot by content or properties.",
    {
      query: z.string().optional().describe("Search query string"),
      filters: z
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
            ]),
            value: z.string(),
          })
        )
        .optional()
        .describe("Filter criteria"),
      limit: z.number().min(1).max(100).default(10),
      after: z.string().optional(),
      properties: z.array(z.string()).optional(),
    },
    async ({ query, filters, limit, after, properties }) => {
      try {
        const defaultProps = [
          "hs_note_body",
          "hs_timestamp",
          "hubspot_owner_id",
        ];

        const searchRequest = {
          limit,
          after: after || undefined,
          sorts: [],
          properties: properties || defaultProps,
          filterGroups: filters && filters.length > 0 ? [{ filters }] : [],
          ...(query && { query }),
        };

        const response =
          await hubspotClient.crm.objects.notes.searchApi.doSearch(
            searchRequest as Parameters<
              typeof hubspotClient.crm.objects.notes.searchApi.doSearch
            >[0]
          );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: response.total,
                  results: response.results.map((note) => ({
                    id: note.id,
                    body: note.properties.hs_note_body,
                    timestamp: note.properties.hs_timestamp,
                    ownerId: note.properties.hubspot_owner_id,
                    createdAt: note.createdAt,
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
              text: `Error searching notes: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
