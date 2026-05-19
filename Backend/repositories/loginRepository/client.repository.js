import Client from '../../models/client.model.js';

export const getClientCredentialsByUserId = async (userId) => {
  const client = await Client.findOne({ user: userId }).lean();
  return {
    wazuhCredentials: client?.wazuhCredentials || null,
    indexerCredentials: client?.indexerCredentials || null
  };
};
