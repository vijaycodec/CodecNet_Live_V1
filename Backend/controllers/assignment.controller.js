import {
  createAssignmentService,
  getAllAssignmentsService,
  getAssignmentByIdService,
  updateAssignmentService,
  updateAssignmentStatusService,
  transferAssignmentService,
  completeAssignmentService,
  getAssignmentsByTicketService,
  getAssignmentsByAssigneeService,
  getAssignmentStatisticsService,
  deleteAssignmentService,
  restoreAssignmentService
} from "../services/assignment/assignment.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createAssignment = async (req, res) => {
  try {
    const assignmentData = req.body;
    const createdBy = req.user?.id;

    const newAssignment = await createAssignmentService(assignmentData, createdBy);

    res.status(201).json(new ApiResponse(201, newAssignment, "Assignment created successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Create assignment error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAllAssignments = async (req, res) => {
  try {
    const {
      ticket_id,
      assignee_id,
      assigned_by,
      status,
      assignment_type,
      limit,
      offset,
      sort_by,
      sort_order,
      start_date,
      end_date,
      include_deleted
    } = req.query;

    const filters = {
      ticket_id,
      assignee_id,
      assigned_by,
      status,
      assignment_type,
      start_date,
      end_date
    };

    const options = {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      sort_by: sort_by || 'createdAt',
      sort_order: sort_order || 'desc',
      include_deleted: include_deleted === 'true'
    };

    const assignments = await getAllAssignmentsService(filters, options);

    res.status(200).json(new ApiResponse(200, assignments, "Assignments retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get all assignments error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await getAssignmentByIdService(id);

    res.status(200).json(new ApiResponse(200, assignment, "Assignment retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get assignment by ID error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user?.id;

    const updatedAssignment = await updateAssignmentService(id, updateData, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedAssignment, "Assignment updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update assignment error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateAssignmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;
    const updatedBy = req.user?.id;

    const result = await updateAssignmentStatusService(id, status, comments, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Assignment status updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update assignment status error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const transferAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_assignee_id, transfer_reason } = req.body;
    const transferredBy = req.user?.id;

    const result = await transferAssignmentService(id, new_assignee_id, transfer_reason, transferredBy);

    res.status(200).json(new ApiResponse(200, result, "Assignment transferred successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Transfer assignment error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const completeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { completion_notes } = req.body;
    const completedBy = req.user?.id;

    const result = await completeAssignmentService(id, completion_notes, completedBy);

    res.status(200).json(new ApiResponse(200, result, "Assignment completed successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Complete assignment error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAssignmentsByTicket = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const { status, include_deleted } = req.query;
    const includeDeleted = include_deleted === 'true';

    const assignments = await getAssignmentsByTicketService(ticket_id, status, includeDeleted);

    res.status(200).json(new ApiResponse(200, assignments, "Ticket assignments retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get assignments by ticket error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getMyAssignments = async (req, res) => {
  try {
    const assigneeId = req.user?.id;
    const { status, assignment_type, limit, offset } = req.query;

    const assignments = await getAssignmentsByAssigneeService(
      assigneeId,
      status,
      assignment_type,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.status(200).json(new ApiResponse(200, assignments, "Your assignments retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get my assignments error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAssignmentStatistics = async (req, res) => {
  try {
    const { assignee_id, ticket_id, start_date, end_date } = req.query;

    const statistics = await getAssignmentStatisticsService(assignee_id, ticket_id, start_date, end_date);

    res.status(200).json(new ApiResponse(200, statistics, "Assignment statistics retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get assignment statistics error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const deletedBy = req.user?.id;

    const result = await deleteAssignmentService(id, deletedBy, reason);

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Delete assignment error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const restoreAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const restoredBy = req.user?.id;

    const result = await restoreAssignmentService(id, restoredBy);

    res.status(200).json(new ApiResponse(200, result, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Restore assignment error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};