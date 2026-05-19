// middlewares/fetchClientCredentials.js
import Client from '../models/client.model.js';
import Organisation from '../models/organisation.model.js';
import { decryptPassword } from '../repositories/organisationRepository/organisation.repository.js';

export const fetchClientCred = async (req, res, next) => {
  try {
    if (req.user?.user_type === 'external') {
      // External users (clients) - get credentials from their organization
      // SECURITY FIX: Handle both populated object and ObjectId
      const userOrgId = req.user.organisation_id?._id || req.user.organisation_id;

      if (!userOrgId) {
        return res.status(404).json({ error: 'Client user has no organization assigned.' });
      }

      const organization = await Organisation.findById(userOrgId)
        .select('+wazuh_manager_username +wazuh_manager_password +wazuh_indexer_username +wazuh_indexer_password');
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found for client user.' });
      }

      // Check if organization has required Wazuh credentials
      const hasWazuhCreds = organization.wazuh_manager_ip && organization.wazuh_manager_username && organization.wazuh_manager_password;
      const hasIndexerCreds = organization.wazuh_indexer_ip && organization.wazuh_indexer_username && organization.wazuh_indexer_password;

      console.log(`🔍 Client user ${req.user.username} organization credentials check:`, {
        name: organization.organisation_name,
        hasWazuhCreds: !!hasWazuhCreds,
        hasIndexerCreds: !!hasIndexerCreds,
        wazuh_ip: organization.wazuh_manager_ip || 'missing',
        indexer_ip: organization.wazuh_indexer_ip || 'missing'
      });

      if (!hasWazuhCreds) {
        console.log(`❌ Organization ${organization.organisation_name} missing Wazuh manager credentials for client ${req.user.username}`);
        return res.status(400).json({ error: 'Organization missing Wazuh manager credentials.' });
      }

      req.clientCreds = {
        organizationId: organization._id.toString(),
        clientName: req.user.username || 'Client',
        organisationName: organization.organisation_name || 'Organization',
        wazuhCredentials: {
          host: `https://${organization.wazuh_manager_ip}:${organization.wazuh_manager_port || 55000}`,
          username: organization.wazuh_manager_username,
          password: decryptPassword(organization.wazuh_manager_password) // SECURITY FIX (PATCH 42): Decrypt password
        },
        indexerCredentials: hasIndexerCreds ? {
          host: `https://${organization.wazuh_indexer_ip}:${organization.wazuh_indexer_port || 9200}`,
          username: organization.wazuh_indexer_username,
          password: decryptPassword(organization.wazuh_indexer_password) // SECURITY FIX (PATCH 42): Decrypt password
        } : null
      };

      console.log(`✅ Client credentials set for ${req.user.username} from organization ${organization.organisation_name}`);
    } else if (req.user?.user_type === 'internal') {
      // For internal users, check if specific organization ID is requested
      const orgId = req.query.orgId || req.body.orgId;
      let organization;

      if (orgId) {
        // Get specific organization by ID
        console.log(`🔍 Fetching organization with ID: ${orgId}`);
        organization = await Organisation.findById(orgId)
          .select('+wazuh_manager_username +wazuh_manager_password +wazuh_indexer_username +wazuh_indexer_password');
        if (!organization) {
          console.log(`❌ Organization not found for ID: ${orgId}`);
          return res.status(404).json({ error: 'Organization not found.' });
        }
        console.log(`✅ Found organization: ${organization.organisation_name}`);
      } else {
        // Fallback: get Wazuh credentials from any active organization
        organization = await Organisation.findOne({
          status: 'active',
          wazuh_manager_ip: { $exists: true, $ne: null },
          wazuh_manager_username: { $exists: true, $ne: null }
        }).select('+wazuh_manager_username +wazuh_manager_password +wazuh_indexer_username +wazuh_indexer_password');
      }

      if (organization) {
        // Check if organization has required Wazuh credentials
        const hasWazuhCreds = organization.wazuh_manager_ip && organization.wazuh_manager_username && organization.wazuh_manager_password;
        const hasIndexerCreds = organization.wazuh_indexer_ip && organization.wazuh_indexer_username && organization.wazuh_indexer_password;

        console.log(`🔍 Organization credentials check:`, {
          name: organization.organisation_name,
          hasWazuhCreds: !!hasWazuhCreds,
          hasIndexerCreds: !!hasIndexerCreds,
          wazuh_ip: organization.wazuh_manager_ip || 'missing',
          indexer_ip: organization.wazuh_indexer_ip || 'missing'
        });

        if (!hasWazuhCreds) {
          console.log(`❌ Organization ${organization.organisation_name} missing Wazuh manager credentials`);
          return res.status(400).json({ error: 'Organization missing Wazuh manager credentials.' });
        }

        req.clientCreds = {
          organizationId: organization._id.toString(), // Add org ID for cache keys
          clientName: req.user.username || 'Client',
          organisationName: organization.organisation_name || 'Organization',
          wazuhCredentials: {
            host: `https://${organization.wazuh_manager_ip}:${organization.wazuh_manager_port || 55000}`,
            username: organization.wazuh_manager_username,
            password: decryptPassword(organization.wazuh_manager_password) // SECURITY FIX (PATCH 42): Decrypt password
          },
          indexerCredentials: hasIndexerCreds ? {
            host: `https://${organization.wazuh_indexer_ip}:${organization.wazuh_indexer_port || 9200}`,
            username: organization.wazuh_indexer_username,
            password: decryptPassword(organization.wazuh_indexer_password) // SECURITY FIX (PATCH 42): Decrypt password
          } : null
        };

        console.log(`✅ Client credentials set for ${organization.organisation_name}`);
      } else {
        console.log(`❌ No organization found to fetch credentials from`);
        return res.status(404).json({
          success: false,
          error: 'No organization with Wazuh credentials found. Please select a client organization or ensure at least one organization has Wazuh credentials configured.'
        });
      }
    }

    next(); // Allow other roles to pass through
  } catch (err) {
    console.error('Error fetching client credentials:', err.message);
    res.status(500).json({ error: 'Failed to fetch client credentials.' });
  }
};
