import { z } from "zod";

// Common property schemas for CRM objects
export const ContactPropertiesSchema = z.object({
  email: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  lifecyclestage: z.string().optional(),
  jobtitle: z.string().optional(),
});

export const CompanyPropertiesSchema = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  industry: z.string().optional(),
  numberofemployees: z.string().optional(),
  annualrevenue: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export const DealPropertiesSchema = z.object({
  dealname: z.string().optional(),
  amount: z.string().optional(),
  dealstage: z.string().optional(),
  pipeline: z.string().optional(),
  closedate: z.string().optional(),
  hubspot_owner_id: z.string().optional(),
  description: z.string().optional(),
});

export const TicketPropertiesSchema = z.object({
  subject: z.string().optional(),
  content: z.string().optional(),
  hs_pipeline: z.string().optional(),
  hs_pipeline_stage: z.string().optional(),
  hs_ticket_priority: z.string().optional(),
  hubspot_owner_id: z.string().optional(),
});

export const NotePropertiesSchema = z.object({
  hs_note_body: z.string().optional(),
  hs_timestamp: z.string().optional(),
  hubspot_owner_id: z.string().optional(),
});

// Object types supported by HubSpot CRM
export const ObjectTypeSchema = z.enum([
  "contacts",
  "companies",
  "deals",
  "tickets",
  "notes",
]);

export type ObjectType = z.infer<typeof ObjectTypeSchema>;

// CRM object types (excludes notes for associations)
export const CrmObjectTypeSchema = z.enum([
  "contacts",
  "companies",
  "deals",
  "tickets",
]);

export type CrmObjectType = z.infer<typeof CrmObjectTypeSchema>;

// Pipeline object types
export const PipelineObjectTypeSchema = z.enum(["deals", "tickets"]);

export type PipelineObjectType = z.infer<typeof PipelineObjectTypeSchema>;

// All filter operators supported by HubSpot Search API
export const FilterOperatorSchema = z.enum([
  "EQ",           // Equals
  "NEQ",          // Not equals
  "LT",           // Less than
  "LTE",          // Less than or equal
  "GT",           // Greater than
  "GTE",          // Greater than or equal
  "BETWEEN",      // Between two values (requires value and highValue)
  "IN",           // In list (requires values array)
  "NOT_IN",       // Not in list (requires values array)
  "HAS_PROPERTY", // Property exists (value not required)
  "NOT_HAS_PROPERTY", // Property does not exist (value not required)
  "CONTAINS_TOKEN",     // Contains token
  "NOT_CONTAINS_TOKEN", // Does not contain token
]);

export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

// Pagination schema for list operations
export const PaginationSchema = z.object({
  limit: z.number().min(1).max(100).default(10),
  after: z.string().optional(),
});

// Search filter schema - supports all HubSpot filter types
export const FilterSchema = z.object({
  propertyName: z.string().describe("The property to filter on"),
  operator: FilterOperatorSchema.describe("The filter operator"),
  value: z.string().optional().describe("Single value for most operators"),
  highValue: z.string().optional().describe("Upper bound for BETWEEN operator"),
  values: z.array(z.string()).optional().describe("Array of values for IN/NOT_IN operators"),
});

export type Filter = z.infer<typeof FilterSchema>;

// Search schema for search operations
// Note: HubSpot sorts use string format: "propertyName" for ASC, "-propertyName" for DESC
export const SearchSchema = z.object({
  query: z.string().optional().describe("Full-text search query"),
  filters: z.array(FilterSchema).optional().describe("Property filters"),
  limit: z.number().min(1).max(100).default(10).describe("Number of results to return"),
  after: z.string().optional().describe("Pagination cursor"),
  sorts: z.array(z.string()).optional().describe("Sort properties (prefix with - for descending, e.g., '-createdate')"),
  properties: z.array(z.string()).optional().describe("Properties to include in results"),
});

export type Search = z.infer<typeof SearchSchema>;

// Association category enum matching HubSpot API
export const AssociationCategorySchema = z.enum([
  "HUBSPOT_DEFINED",
  "USER_DEFINED",
  "INTEGRATOR_DEFINED",
]);

export type AssociationCategory = z.infer<typeof AssociationCategorySchema>;

// Helper function to convert filters to HubSpot API format
export function convertFiltersToApiFormat(filters: Filter[]): Array<{
  propertyName: string;
  operator: string;
  value?: string;
  highValue?: string;
  values?: string[];
}> {
  return filters.map((filter) => {
    const apiFilter: {
      propertyName: string;
      operator: string;
      value?: string;
      highValue?: string;
      values?: string[];
    } = {
      propertyName: filter.propertyName,
      operator: filter.operator,
    };

    // Handle different operator requirements
    if (filter.operator === "IN" || filter.operator === "NOT_IN") {
      if (filter.values && filter.values.length > 0) {
        apiFilter.values = filter.values;
      }
    } else if (filter.operator === "BETWEEN") {
      if (filter.value) apiFilter.value = filter.value;
      if (filter.highValue) apiFilter.highValue = filter.highValue;
    } else if (filter.operator !== "HAS_PROPERTY" && filter.operator !== "NOT_HAS_PROPERTY") {
      if (filter.value) apiFilter.value = filter.value;
    }

    return apiFilter;
  });
}

// Helper function to extract detailed error information from HubSpot API errors
export function extractHubSpotError(error: unknown): string {
  if (error instanceof Error) {
    // Check for HubSpot API error response
    const apiError = error as Error & {
      response?: {
        body?: {
          message?: string;
          correlationId?: string;
          category?: string;
          errors?: Array<{ message: string }>;
        };
      };
    };

    if (apiError.response?.body) {
      const body = apiError.response.body;
      const details: string[] = [];

      if (body.message) details.push(body.message);
      if (body.category) details.push(`Category: ${body.category}`);
      if (body.correlationId) details.push(`Correlation ID: ${body.correlationId}`);
      if (body.errors && body.errors.length > 0) {
        details.push(`Details: ${body.errors.map(e => e.message).join(", ")}`);
      }

      if (details.length > 0) {
        return details.join(" | ");
      }
    }

    return error.message;
  }

  return "Unknown error";
}
