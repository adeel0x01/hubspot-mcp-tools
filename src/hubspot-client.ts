import { Client } from "@hubspot/api-client";

const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

if (!accessToken) {
  console.error("Error: HUBSPOT_ACCESS_TOKEN environment variable is required");
  process.exit(1);
}

export const hubspotClient = new Client({
  accessToken,
  numberOfApiCallRetries: 3,
});
