
import { loginService } from '../services/auth.service.new.js';  // SECURITY: Updated to use session-aware service

export const login = async (req, res) => {
  try {
    const { email, identifier, password } = req.body;
    const userEmail = email || identifier; // Accept both email and identifier
    const result = await loginService(userEmail, password);

    return res.status(200).json({
      message: `Welcome ${result.user.full_name || 'User'}`,
      data: {
        access_token: result.token,
        user: result.user
        // SECURITY: Credentials removed - handled server-side only
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(error.status || 500).json({ message: error.message || "Internal Server Error" });
  }
};


