import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  findUserByEmail,
} from "../repositories/loginRepository/loginuser.repository.js";
import { getClientCredentialsByUserId } from "../repositories/loginRepository/client.repository.js";

export const loginService = async (email, password) => {
  if (!email || !password) {
    throw { status: 400, message: "Email and password are required." };
  }

  const user = await findUserByEmail(email);
  if (!user) throw { status: 401, message: "Invalid email or password." };
  if (user.status !== 'active')
    throw {
      status: 403,
      message: "Your account is inactive. Please contact admin.",
    };

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw { status: 401, message: "Invalid email or password." };


  const token = jwt.sign(
    {
      id: user._id,
      role: user.role_id?.role_name,
      organisation_id: user.organisation_id,
      user_type: user.user_type
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  // SECURITY: Use user_type instead of hardcoded role name
  // External users are clients who get Wazuh credentials from their organization
  const clientData =
    user.user_type === "external"
      ? await getClientCredentialsByUserId(user._id)
      : { wazuhCredentials: null, indexerCredentials: null };

  return {
    token,
    user: {
      id: user._id,
      full_name: user.full_name,
      email: user.email,
      role: user.role_id?.role_name,
      status: user.status,
      organisation_id: user.organisation_id,
      user_type: user.user_type,
      permissions: user.role_id?.permissions || {},
    },
    ...clientData,
  };
};
