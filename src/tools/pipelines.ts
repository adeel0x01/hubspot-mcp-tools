import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hubspotClient } from "../hubspot-client.js";
import { PipelineObjectTypeSchema, extractHubSpotError } from "../types.js";

export function registerPipelineTools(server: McpServer) {
  // Get all pipelines for an object type
  server.tool(
    "hubspot_get_pipelines",
    "Get all pipelines for deals or tickets. Pipelines define the stages that records move through.",
    {
      objectType: PipelineObjectTypeSchema.describe(
        "The object type to get pipelines for (deals or tickets)"
      ),
    },
    async ({ objectType }) => {
      try {
        const response = await hubspotClient.crm.pipelines.pipelinesApi.getAll(
          objectType
        );

        const pipelines = response.results.map((pipeline) => ({
          id: pipeline.id,
          label: pipeline.label,
          displayOrder: pipeline.displayOrder,
          archived: pipeline.archived,
          stages: pipeline.stages?.map((stage) => ({
            id: stage.id,
            label: stage.label,
            displayOrder: stage.displayOrder,
            metadata: stage.metadata,
            archived: stage.archived,
          })),
          createdAt: pipeline.createdAt,
          updatedAt: pipeline.updatedAt,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  objectType,
                  total: pipelines.length,
                  pipelines,
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
              text: `Error getting pipelines: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get a specific pipeline by ID
  server.tool(
    "hubspot_get_pipeline",
    "Get detailed information about a specific pipeline including all its stages.",
    {
      objectType: PipelineObjectTypeSchema.describe(
        "The object type the pipeline belongs to (deals or tickets)"
      ),
      pipelineId: z.string().describe("The pipeline ID"),
    },
    async ({ objectType, pipelineId }) => {
      try {
        const pipeline = await hubspotClient.crm.pipelines.pipelinesApi.getById(
          objectType,
          pipelineId
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: pipeline.id,
                  label: pipeline.label,
                  displayOrder: pipeline.displayOrder,
                  archived: pipeline.archived,
                  stages: pipeline.stages?.map((stage) => ({
                    id: stage.id,
                    label: stage.label,
                    displayOrder: stage.displayOrder,
                    metadata: stage.metadata,
                    archived: stage.archived,
                  })),
                  createdAt: pipeline.createdAt,
                  updatedAt: pipeline.updatedAt,
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
              text: `Error getting pipeline: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get all stages for a pipeline
  server.tool(
    "hubspot_get_pipeline_stages",
    "Get all stages for a specific pipeline. Use this to see valid stage values for deals or tickets.",
    {
      objectType: PipelineObjectTypeSchema.describe(
        "The object type (deals or tickets)"
      ),
      pipelineId: z.string().describe("The pipeline ID"),
    },
    async ({ objectType, pipelineId }) => {
      try {
        const response =
          await hubspotClient.crm.pipelines.pipelineStagesApi.getAll(
            objectType,
            pipelineId
          );

        const stages = response.results.map((stage) => ({
          id: stage.id,
          label: stage.label,
          displayOrder: stage.displayOrder,
          metadata: stage.metadata,
          archived: stage.archived,
          createdAt: stage.createdAt,
          updatedAt: stage.updatedAt,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  objectType,
                  pipelineId,
                  total: stages.length,
                  stages,
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
              text: `Error getting pipeline stages: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get a specific stage
  server.tool(
    "hubspot_get_pipeline_stage",
    "Get detailed information about a specific pipeline stage.",
    {
      objectType: PipelineObjectTypeSchema.describe(
        "The object type (deals or tickets)"
      ),
      pipelineId: z.string().describe("The pipeline ID"),
      stageId: z.string().describe("The stage ID"),
    },
    async ({ objectType, pipelineId, stageId }) => {
      try {
        const stage =
          await hubspotClient.crm.pipelines.pipelineStagesApi.getById(
            objectType,
            pipelineId,
            stageId
          );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: stage.id,
                  label: stage.label,
                  displayOrder: stage.displayOrder,
                  metadata: stage.metadata,
                  archived: stage.archived,
                  createdAt: stage.createdAt,
                  updatedAt: stage.updatedAt,
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
              text: `Error getting pipeline stage: ${extractHubSpotError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
