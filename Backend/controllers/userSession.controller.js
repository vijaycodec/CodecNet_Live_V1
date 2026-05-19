import {
  getAllUserSessionsService,
  getUserSessionByIdService,
  getUserSessionsByUserService,
  getActiveSessionsService,
  terminateSessionService,
  terminateAllUserSessionsService,
  terminateSessionsByIpService,
  getSessionStatisticsService,
  updateSessionActivityService,
  refreshSessionService,
  getSessionsByDeviceService,
  searchSessionsService
} from "../services/userSession/userSession.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const getAllSessions = async (req, res) => {
  try {
    const {
      user_id,
      is_active,
      ip_address,
      user_agent,
      limit,
      offset,
      sort_by,
      sort_order,
      start_date,
      end_date
    } = req.query;

    const filters = {
      user_id,
      is_active: is_active ? is_active === 'true' : undefined,
      ip_address,
      user_agent,
      start_date,
      end_date
    };

    const options = {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      sort_by: sort_by || 'createdAt',
      sort_order: sort_order || 'desc'
    };

    const sessions = await getAllUserSessionsService(filters, options);

    res.status(200).json(new ApiResponse(200, sessions, "User sessions retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get all sessions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await getUserSessionByIdService(id);

    res.status(200).json(new ApiResponse(200, session, "Session retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get session by ID error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getUserSessions = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { is_active, limit, offset } = req.query;

    const sessions = await getUserSessionsByUserService(
      user_id,
      is_active ? is_active === 'true' : undefined,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.status(200).json(new ApiResponse(200, sessions, "User sessions retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get user sessions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getActiveSessions = async (req, res) => {
  try {
    const { user_id, limit, offset } = req.query;

    const sessions = await getActiveSessionsService(
      user_id,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.status(200).json(new ApiResponse(200, sessions, "Active sessions retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get active sessions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getMySessions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { is_active, limit, offset } = req.query;

    const sessions = await getUserSessionsByUserService(
      userId,
      is_active ? is_active === 'true' : undefined,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.status(200).json(new ApiResponse(200, sessions, "Your sessions retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get my sessions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const terminateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { termination_reason } = req.body;
    const terminatedBy = req.user?.id;

    const result = await terminateSessionService(id, termination_reason || 'manual_termination', terminatedBy);

    res.status(200).json(new ApiResponse(200, result, "Session terminated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Terminate session error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const terminateAllUserSessions = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { termination_reason } = req.body;
    const terminatedBy = req.user?.id;

    const result = await terminateAllUserSessionsService(user_id, termination_reason || 'admin_action', terminatedBy);

    res.status(200).json(new ApiResponse(200, result, "All user sessions terminated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Terminate all user sessions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const terminateMyOtherSessions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const currentSessionId = req.session?.id; // Current session ID from middleware
    const { termination_reason } = req.body;

    const result = await terminateAllUserSessionsService(
      userId, 
      termination_reason || 'user_request',
      userId,
      currentSessionId // Exclude current session
    );

    res.status(200).json(new ApiResponse(200, result, "Other sessions terminated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Terminate my other sessions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const terminateSessionsByIp = async (req, res) => {
  try {
    const { ip_address } = req.params;
    const { termination_reason } = req.body;
    const terminatedBy = req.user?.id;

    const result = await terminateSessionsByIpService(ip_address, termination_reason || 'security_action', terminatedBy);

    res.status(200).json(new ApiResponse(200, result, "Sessions from IP terminated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Terminate sessions by IP error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getSessionStatistics = async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;

    const statistics = await getSessionStatisticsService(user_id, start_date, end_date);

    res.status(200).json(new ApiResponse(200, statistics, "Session statistics retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get session statistics error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateSessionActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { activity_data } = req.body;

    const result = await updateSessionActivityService(id, activity_data);

    res.status(200).json(new ApiResponse(200, result, "Session activity updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update session activity error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const refreshSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_access_token, new_refresh_token, extension_hours } = req.body;

    const result = await refreshSessionService(id, new_access_token, new_refresh_token, extension_hours);

    res.status(200).json(new ApiResponse(200, result, "Session refreshed successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Refresh session error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getSessionsByDevice = async (req, res) => {
  try {
    const { device_info } = req.query;
    const { limit, offset } = req.query;

    const sessions = await getSessionsByDeviceService(
      device_info,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.status(200).json(new ApiResponse(200, sessions, "Sessions by device retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get sessions by device error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const searchSessions = async (req, res) => {
  try {
    const { q, limit, offset } = req.query;
    const searchTerm = q;
    const searchLimit = parseInt(limit) || 20;
    const searchOffset = parseInt(offset) || 0;

    const sessions = await searchSessionsService(searchTerm, searchLimit, searchOffset);

    res.status(200).json(new ApiResponse(200, sessions, "Session search completed"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Search sessions error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};