# HubSpot MCP Server

A Model Context Protocol (MCP) server that provides seamless integration with HubSpot's CRM APIs. This server enables Claude Desktop and other MCP clients to manage HubSpot resources and execute CRM operations directly through natural language.

**58 comprehensive tools** covering the complete HubSpot CRM workflow including Contacts, Companies, Deals, Tickets, Notes, Associations, Owners, Pipelines, and Properties management.

## Usage

Use with any MCP-compatible client like Claude/Cursor/VS Code. Add the following configuration to your MCP settings:

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "npx",
      "args": ["-y", "hubspot-mcp-tools"],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your_access_token_here"
      }
    }
  }
}
```

Replace `your_access_token_here` with your HubSpot private app access token.

## Available Tools

### Contacts API (9 tools)

- **hubspot_create_contact** - Create a new contact in HubSpot
- **hubspot_get_contact** - Get a contact by ID from HubSpot
- **hubspot_list_contacts** - List contacts with pagination
- **hubspot_search_contacts** - Search contacts by email, name, or other properties with advanced filtering
- **hubspot_update_contact** - Update contact properties
- **hubspot_delete_contact** - Archive (soft delete) a contact
- **hubspot_batch_create_contacts** - Create multiple contacts at once (max 100)
- **hubspot_batch_update_contacts** - Update multiple contacts at once (max 100)

### Companies API (9 tools)

- **hubspot_create_company** - Create a new company in HubSpot
- **hubspot_get_company** - Get a company by ID from HubSpot
- **hubspot_list_companies** - List companies with pagination
- **hubspot_search_companies** - Search companies by name, domain, or other properties with advanced filtering
- **hubspot_update_company** - Update company properties
- **hubspot_delete_company** - Archive (soft delete) a company
- **hubspot_batch_create_companies** - Create multiple companies at once (max 100)
- **hubspot_batch_update_companies** - Update multiple companies at once (max 100)

### Deals API (9 tools)

- **hubspot_create_deal** - Create a new deal in HubSpot (use `hubspot_get_pipelines` for available pipelines/stages)
- **hubspot_get_deal** - Get a deal by ID from HubSpot
- **hubspot_list_deals** - List deals with pagination
- **hubspot_search_deals** - Search deals by name, stage, amount, or other properties with advanced filtering
- **hubspot_update_deal** - Update deal properties
- **hubspot_delete_deal** - Archive (soft delete) a deal
- **hubspot_batch_create_deals** - Create multiple deals at once (max 100)
- **hubspot_batch_update_deals** - Update multiple deals at once (max 100)

### Tickets API (9 tools)

- **hubspot_create_ticket** - Create a new ticket in HubSpot (use `hubspot_get_pipelines` for available pipelines/stages)
- **hubspot_get_ticket** - Get a ticket by ID from HubSpot
- **hubspot_list_tickets** - List tickets with pagination
- **hubspot_search_tickets** - Search tickets by subject, status, or other properties with advanced filtering
- **hubspot_update_ticket** - Update ticket properties
- **hubspot_delete_ticket** - Archive (soft delete) a ticket
- **hubspot_batch_create_tickets** - Create multiple tickets at once (max 100)
- **hubspot_batch_update_tickets** - Update multiple tickets at once (max 100)

### Notes API (8 tools)

- **hubspot_create_note** - Create a note and optionally associate with a HubSpot object
- **hubspot_get_note** - Get a specific note by its ID
- **hubspot_get_object_notes** - Get notes associated with a HubSpot object
- **hubspot_list_notes** - List all notes with pagination
- **hubspot_update_note** - Update note content or properties
- **hubspot_delete_note** - Archive (soft delete) a note
- **hubspot_search_notes** - Search notes by content or properties

### Associations API (5 tools)

- **hubspot_get_association_types** - Get all available association types between two object types
- **hubspot_create_association** - Create an association between two HubSpot objects
- **hubspot_get_associations** - Get all associations for a HubSpot object
- **hubspot_delete_association** - Remove an association between two objects
- **hubspot_batch_create_associations** - Create multiple associations at once

### Owners API (2 tools)

- **hubspot_list_owners** - List all HubSpot owners (users) in the account
- **hubspot_get_owner** - Get detailed information about a specific owner

### Pipelines API (4 tools)

- **hubspot_get_pipelines** - Get all pipelines for deals or tickets
- **hubspot_get_pipeline** - Get detailed pipeline information including stages
- **hubspot_get_pipeline_stages** - Get all stages for a specific pipeline
- **hubspot_get_pipeline_stage** - Get detailed information about a specific stage

### Properties API (3 tools)

- **hubspot_get_properties** - Get all available properties for a HubSpot object type
- **hubspot_get_property** - Get detailed property information including options and validation
- **hubspot_get_property_groups** - Get all property groups for a HubSpot object type

## Development

### Local Setup

1. **Prerequisite**:
   - Node.js v18+
   - pnpm v9+

2. **Clone the repository**:

```bash
git clone https://github.com/adeel0x01/hubspot-mcp-tools.git
cd hubspot-mcp-tools
```

3. **Install dependencies**:

```bash
pnpm install
```

4. **Build the project**:

```bash
pnpm run build
```

### Testing

```bash
pnpm run inspector  # Opens MCP Inspector
```

## Error Handling

The server provides detailed error messages for common issues:

- **Missing API Key**: Clear instructions on how to set the HUBSPOT_ACCESS_TOKEN
- **HubSpot API Errors**: Includes status code, message, and request details for debugging
- **Validation Errors**: Helpful messages for invalid parameters or missing required fields

All errors are logged to stderr (safe for stdio transport) and returned to the client in a structured format.

## Important Notes

### Security Considerations

- Never commit your `.env` file or expose your HubSpot access token
- The access token is passed via environment variables for security
- Use HubSpot private apps with minimal required scopes

### HubSpot Access Token

To use this server, you need a HubSpot private app access token with the following scopes:

**Required Scopes:**

- `crm.objects.contacts.read` and `crm.objects.contacts.write`
- `crm.objects.companies.read` and `crm.objects.companies.write`
- `crm.objects.deals.read` and `crm.objects.deals.write`
- `tickets` (read and write)
- `crm.objects.owners.read`
- `crm.schemas.contacts.read`
- `crm.schemas.companies.read`
- `crm.schemas.deals.read`

**Create a private app:**

1. Go to HubSpot Settings > Integrations > Private Apps
2. Click "Create a private app"
3. Add the required scopes listed above
4. Generate the access token
5. Copy the token and use it as `HUBSPOT_ACCESS_TOKEN`

Private Apps Documentation: https://developers.hubspot.com/docs/api/private-apps

### Rate Limits

This server respects HubSpot's API rate limits:

- Professional/Enterprise: 100 requests per 10 seconds
- Batch operations can process up to 100 records at once

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT
