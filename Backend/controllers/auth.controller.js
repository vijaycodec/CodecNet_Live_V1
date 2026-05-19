import {
  loginService
} from "../services/auth.service.new.js";  // SECURITY: Updated to use session-aware service
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // SECURITY: Capture IP and user agent for session tracking
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceInfo = { user_agent: userAgent, ip_address: ipAddress };

    const result = await loginService(identifier, password, ipAddress, userAgent, deviceInfo);

    return res.status(200).json({
      success: true,
      message: `Welcome ${result.user.full_name || 'User'}`,
      data: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        user: result.user
        // SECURITY: Credentials removed - handled server-side only
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(error.status || 500).json({ message: error.message || "Internal Server Error" });
  }
};

export const verify2FA = async (req, res) => {
  try {
    const { user_id, totp_code } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceInfo = {
      browser: req.headers['sec-ch-ua'] || 'unknown',
      platform: req.headers['sec-ch-ua-platform'] || 'unknown',
      mobile: req.headers['sec-ch-ua-mobile'] === '?1'
    };

    const result = await verify2FAService(user_id, totp_code, ipAddress, userAgent, deviceInfo);
    
    const { access_token, refresh_token, ...userData } = result;

    // SECURITY FIX (PATCH 55): Secure cookie settings (CWE-1004, CWE-614)
    // SECURITY FIX (PATCH 56): Restrictive path attribute (CWE-284)
    res.cookie('refreshToken', refresh_token, {
      httpOnly: true,  // Prevent JavaScript access (XSS protection)
      secure: true,    // Only transmit over HTTPS (was conditional)
      sameSite: 'strict',  // CSRF protection
      path: '/api',    // Restrict to API routes only
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    });

    res.status(200).json(new ApiResponse(200, {
      access_token,
      token_type: result.token_type,
      expires_in: result.expires_in,
      user: result.user
    }, "Two-factor authentication successful"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('2FA verification error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refresh_token;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    const result = await refreshTokenService(refreshToken, ipAddress);

    // SECURITY FIX (PATCH 55): Secure cookie settings (CWE-1004, CWE-614)
    // SECURITY FIX (PATCH 56): Restrictive path attribute (CWE-284)
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,  // Prevent JavaScript access (XSS protection)
      secure: true,    // Only transmit over HTTPS (was conditional)
      sameSite: 'strict',  // CSRF protection
      path: '/api',    // Restrict to API routes only
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    });

    res.status(200).json(new ApiResponse(200, {
      access_token: result.access_token,
      token_type: result.token_type,
      expires_in: result.expires_in
    }, "Token refreshed successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Token refresh error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    const result = await logoutService(token);

    // SECURITY FIX (PATCH 49): Clear all cookies and add cache-clearing headers
    // SECURITY FIX (PATCH 56): clearCookie with matching options (CWE-284)
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/'
    });
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/'
    });
    res.clearCookie('session', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/'
    });

    // Force client to clear cache
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json(new ApiResponse(200, {
      clearCache: true,
      clearStorage: true
    }, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Logout error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const logoutAllSessions = async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await logoutAllSessionsService(userId);

    // SECURITY FIX (PATCH 49): Clear all cookies and add cache-clearing headers
    // SECURITY FIX (PATCH 56): clearCookie with matching options (CWE-284)
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/'
    });
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/'
    });
    res.clearCookie('session', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/'
    });

    // Force client to clear cache
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json(new ApiResponse(200, {
      clearCache: true,
      clearStorage: true,
      sessionsDeleted: result.deletedCount || 0
    }, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Logout all sessions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await requestPasswordResetService(email, ipAddress, userAgent);

    res.status(200).json(new ApiResponse(200, {
      message: result.message,
      ...(process.env.NODE_ENV !== 'production' && { reset_token: result.reset_token })
    }));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Password reset request error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    const result = await resetPasswordService(reset_token, new_password, ipAddress);

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Password reset error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const setupTwoFactor = async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await setupTwoFactorService(userId);

    res.status(200).json(new ApiResponse(200, result, "Two-factor authentication setup initiated"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('2FA setup error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const enableTwoFactor = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { secret, totp_code } = req.body;

    const result = await enableTwoFactorService(userId, secret, totp_code);

    res.status(200).json(new ApiResponse(200, result, "Two-factor authentication enabled successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('2FA enable error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const disableTwoFactor = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { current_password } = req.body;

    const result = await disableTwoFactorService(userId, current_password);

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('2FA disable error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const validateSession = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    const result = await validateSessionService(token);

    res.status(200).json(new ApiResponse(200, result, "Session is valid"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Session validation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { current_password, new_password } = req.body;

    const result = await changePasswordService(userId, current_password, new_password);

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Password change error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};