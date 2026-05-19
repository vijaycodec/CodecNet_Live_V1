import {
  createTicketService,
  getAllTicketsService,
  getTicketByIdService,
  updateTicketService,
  updateTicketStatusService,
  updateTicketPriorityService,
  assignTicketService,
  transferTicketService,
  addTicketCommentService,
  closeTicketService,
  reopenTicketService,
  searchTicketsService,
  getTicketsByStatusService,
  getTicketsByPriorityService,
  getTicketsByAssigneeService,
  getTicketsByOrganisationService,
  getTicketStatisticsService,
  bulkUpdateTicketsService,
  deleteTicketService,
  restoreTicketService,
  updateTicketTimeService,
  assignTicketToAssetService
} from "../services/ticket.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createTicket = async (req, res) => {
  try {
    console.log('=== CREATE TICKET REQUEST ===');
    console.log('req.user:', req.user);
    console.log('req.body:', req.body);

    const ticketData = req.body;
    const createdBy = req.user?.id;
    const organisationId = ticketData.organisation_id || req.user?.organisation_id;

    // Validate required user data
    if (!createdBy) {
      return res.status(400).json(new ApiResponse(400, null, "User ID is required"));
    }
    if (!organisationId) {
      return res.status(400).json(new ApiResponse(400, null, "Organisation ID is required"));
    }
    if (!ticketData.title || ticketData.title.length < 3) {
      return res.status(400).json(new ApiResponse(400, null, "Title is required and must be at least 3 characters"));
    }

    // Add required fields to ticket data
    ticketData.user_id = createdBy;
    ticketData.organisation_id = organisationId;
    ticketData.created_by = createdBy;

    console.log('Creating ticket with data:', ticketData);

    const newTicket = await createTicketService(ticketData);

    res.status(201).json(new ApiResponse(201, newTicket, "Ticket created successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Create ticket error:', error);
    console.error('Request body:', req.body);
    console.error('User:', req.user);

    // Check if it's a mongoose validation error
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json(new ApiResponse(400, null, `Validation failed: ${validationErrors.join(', ')}`));
    }

    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAllTickets = async (req, res) => {
  try {
    console.log(`=== GET ALL TICKETS CONTROLLER [${req.requestId || 'no-id'}] ===`);
    console.log('req.query:', req.query);
    console.log('req.user.organisation_id:', req.user?.organisation_id);

    const {
      organisation_id,
      status,
      priority,
      assignee_id,
      created_by,
      category,
      sub_category,
      limit,
      offset,
      sort_by,
      sort_order,
      start_date,
      end_date,
      include_deleted
    } = req.query;

    const filters = {
      organisation_id: organisation_id || req.user?.organisation_id,
      status,
      priority,
      assignee_id,
      created_by,
      category,
      sub_category,
      start_date,
      end_date
    };

    const options = {
      limit: parseInt(limit) || 0,
      offset: parseInt(offset) || 0,
      sort_by: sort_by || 'createdAt',
      sort_order: sort_order || 'desc',
      include_deleted: include_deleted === 'true'
    };

    console.log('filters:', filters);
    console.log('options:', options);

    const tickets = await getAllTicketsService(filters, options);

    console.log('tickets result:', tickets);
    console.log('tickets length:', tickets?.length);

    res.status(200).json(new ApiResponse(200, tickets, "Tickets retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get all tickets error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await getTicketByIdService(id);

    res.status(200).json(new ApiResponse(200, ticket, "Ticket retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get ticket by ID error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user?.id;

    const updatedTicket = await updateTicketService(id, updateData, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedTicket, "Ticket updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update ticket error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment, resolution_type, resolution_notes } = req.body;
    const updatedBy = req.user?.id;

    // Validate resolution data when status is resolved
    if (status === 'resolved') {
      if (!resolution_type || !['false_positive', 'true_positive'].includes(resolution_type)) {
        return res.status(400).json(new ApiResponse(400, null, "Resolution type is required when resolving a ticket. Must be 'false_positive' or 'true_positive'"));
      }
      if (!resolution_notes || resolution_notes.trim().length === 0) {
        return res.status(400).json(new ApiResponse(400, null, "Resolution notes are required when resolving a ticket"));
      }
    }

    const result = await updateTicketStatusService(id, status, comment, updatedBy, resolution_type, resolution_notes);

    res.status(200).json(new ApiResponse(200, result, "Ticket status updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update ticket status error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee_id, comment } = req.body;
    const assignedBy = req.user?.id;

    const result = await assignTicketService(id, assignee_id, assignedBy, comment);

    res.status(200).json(new ApiResponse(200, result, "Ticket assigned successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Assign ticket error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, is_internal } = req.body;
    const commentedBy = req.user?.id;

    const result = await addTicketCommentService(id, comment, commentedBy, is_internal);

    res.status(201).json(new ApiResponse(201, result, "Comment added successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Add ticket comment error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getTicketStats = async (req, res) => {
  try {
    const { organisation_id, assignee_id, start_date, end_date } = req.query;
    const orgId = organisation_id || req.user?.organisation_id;

    const statistics = await getTicketStatisticsService(orgId, assignee_id, start_date, end_date);

    res.status(200).json(new ApiResponse(200, statistics, "Ticket statistics retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get ticket statistics error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const deletedBy = req.user?.id;

    const result = await deleteTicketService(id, deletedBy, reason);

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Delete ticket error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const searchTickets = async (req, res) => {
  try {
    const { q, organisation_id, limit, offset } = req.query;
    const searchTerm = q;
    const orgId = organisation_id || req.user?.organisation_id;
    const searchLimit = parseInt(limit) || 0;
    const searchOffset = parseInt(offset) || 0;

    const tickets = await searchTicketsService(searchTerm, orgId, searchLimit, searchOffset);

    res.status(200).json(new ApiResponse(200, tickets, "Ticket search completed"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Search tickets error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getMyTickets = async (req, res) => {
  try {
    const assigneeId = req.user?.id;
    const { status, priority, limit, offset } = req.query;

    const tickets = await getTicketsByAssigneeService(
      assigneeId,
      status,
      priority,
      parseInt(limit) || 0,
      parseInt(offset) || 0
    );

    res.status(200).json(new ApiResponse(200, tickets, "Your tickets retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get my tickets error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateTicketTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { estimated_hours, actual_hours } = req.body;
    const updatedBy = req.user?.id;

    const result = await updateTicketTimeService(id, estimated_hours, actual_hours, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Ticket time updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update ticket time error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const assignTicketToAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { asset_id } = req.body;
    const updatedBy = req.user?.id;

    if (!asset_id) {
      return res.status(400).json(new ApiResponse(400, null, "Asset ID is required"));
    }

    const result = await assignTicketToAssetService(id, asset_id, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Ticket assigned to asset successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Assign ticket to asset error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};