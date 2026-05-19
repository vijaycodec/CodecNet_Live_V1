// utils/getWazuhCreds.js
import Client from '../models/client.model.js';

export const getWazuhCredentialsByUserId = async (userId) => {
  const client = await Client.findOne({ user: userId });

  if (!client || !client.wazuhCredentials) {
    throw new Error('Wazuh credentials not found for this user');
  }

  const { host, username, password } = client.wazuhCredentials;
  return { host, username, password };
};
