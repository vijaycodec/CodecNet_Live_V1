import * as ticketRepository from '../repositories/ticketRepository/ticket.repository.js';
import { ApiError } from '../utils/ApiError.js';

export const createTicketService = async (ticketData) => {
  try {
    return await ticketRepository.createTicket(ticketData);
  } catch (error) {
    throw new ApiError(500, 'Error creating ticket: ' + error.message);
  }
};

export const getAllTicketsService = async (filters, options) => {
  try {
    return await ticketRepository.findAllTickets(
      filters.organisation_id,
      options.limit,
      filters.start_date,
      filters.end_date
    );
  } catch (error) {
    throw new ApiError(500, 'Error fetching tickets: ' + error.message);
  }
};

export const getTicketByIdService = async (id, populateFields) => {
  try {
    const ticket = await ticketRepository.findTicketById(id, populateFields);
    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }
    return ticket;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error fetching ticket: ' + error.message);
  }
};

export const updateTicketService = async (id, updateData, userId) => {
  try {
    const ticket = await ticketRepository.updateTicketById(id, updateData, userId);
    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }
    return ticket;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error updating ticket: ' + error.message);
  }
};

export const updateTicketStatusService = async (id, status, statusNotes, userId, resolutionType, resolutionNotes) => {
  try {
    return await ticketRepository.updateTicketStatus(id, status, userId, statusNotes, resolutionType, resolutionNotes);
  } catch (error) {
    throw new ApiError(500, 'Error updating ticket status: ' + error.message);
  }
};

export const updateTicketPriorityService = async (id, priority, userId) => {
  try {
    const updateData = { priority };
    return await ticketRepository.updateTicketById(id, updateData, userId);
  } catch (error) {
    throw new ApiError(500, 'Error updating ticket priority: ' + error.message);
  }
};

export const assignTicketService = async (id, assigneeId, assignedBy) => {
  try {
    const updateData = { assigned_to: assigneeId, assigned_by: assignedBy };
    return await ticketRepository.updateTicketById(id, updateData, assignedBy);
  } catch (error) {
    throw new ApiError(500, 'Error assigning ticket: ' + error.message);
  }
};

export const transferTicketService = async (id, fromUserId, toUserId, transferredBy) => {
  try {
    const updateData = { 
      assigned_to: toUserId, 
      previous_assignee: fromUserId,
      transferred_by: transferredBy 
    };
    return await ticketRepository.updateTicketById(id, updateData, transferredBy);
  } catch (error) {
    throw new ApiError(500, 'Error transferring ticket: ' + error.message);
  }
};

export const addTicketCommentService = async (id, commentData) => {
  try {
    return await ticketRepository.addTicketComment(id, commentData.userId, commentData.comment);
  } catch (error) {
    throw new ApiError(500, 'Error adding comment: ' + error.message);
  }
};

export const closeTicketService = async (id, closedBy, reason) => {
  try {
    return await ticketRepository.updateTicketStatus(id, 'resolved', closedBy, reason);
  } catch (error) {
    throw new ApiError(500, 'Error closing ticket: ' + error.message);
  }
};

export const reopenTicketService = async (id, reopenedBy, reason) => {
  try {
    return await ticketRepository.updateTicketStatus(id, 'open', reopenedBy, reason);
  } catch (error) {
    throw new ApiError(500, 'Error reopening ticket: ' + error.message);
  }
};

export const searchTicketsService = async (searchTerm, organisationId, limit = 0) => {
  try {
    return await ticketRepository.searchTickets(searchTerm, organisationId, limit);
  } catch (error) {
    throw new ApiError(500, 'Error searching tickets: ' + error.message);
  }
};

export const getTicketsByStatusService = async (status, organisationId) => {
  try {
    return await ticketRepository.findTicketsByStatus(status, organisationId);
  } catch (error) {
    throw new ApiError(500, 'Error fetching tickets by status: ' + error.message);
  }
};

export const getTicketsByPriorityService = async (priority, organisationId) => {
  try {
    const updateData = { priority };
    return await ticketRepository.findTicketsBySeverity(priority, organisationId);
  } catch (error) {
    throw new ApiError(500, 'Error fetching tickets by priority: ' + error.message);
  }
};

export const getTicketsByAssigneeService = async (assigneeId, organisationId) => {
  try {
    return await ticketRepository.findTicketsByUser(assigneeId, organisationId);
  } catch (error) {
    throw new ApiError(500, 'Error fetching tickets by assignee: ' + error.message);
  }
};

export const getTicketsByOrganisationService = async (organisationId) => {
  try {
    return await ticketRepository.findTicketsByOrganisation(organisationId);
  } catch (error) {
    throw new ApiError(500, 'Error fetching tickets by organisation: ' + error.message);
  }
};

export const getTicketStatisticsService = async (organisationId, days = 30) => {
  try {
    return await ticketRepository.getTicketStatistics(organisationId, days);
  } catch (error) {
    throw new ApiError(500, 'Error fetching ticket statistics: ' + error.message);
  }
};

export const bulkUpdateTicketsService = async (ticketIds, updateData, userId) => {
  try {
    return await ticketRepository.bulkUpdateTickets(ticketIds, updateData, userId);
  } catch (error) {
    throw new ApiError(500, 'Error bulk updating tickets: ' + error.message);
  }
};

export const deleteTicketService = async (id, deletedBy, reason) => {
  try {
    return await ticketRepository.deleteTicketById(id);
  } catch (error) {
    throw new ApiError(500, 'Error deleting ticket: ' + error.message);
  }
};

export const restoreTicketService = async (id, restoredBy) => {
  try {
    const updateData = { deleted_at: null, deleted_by: null, is_deleted: false };
    return await ticketRepository.updateTicketById(id, updateData, restoredBy);
  } catch (error) {
    throw new ApiError(500, 'Error restoring ticket: ' + error.message);
  }
};

export const updateTicketTimeService = async (id, estimatedHours, actualHours, userId) => {
  try {
    return await ticketRepository.updateTicketTime(id, estimatedHours, actualHours, userId);
  } catch (error) {
    throw new ApiError(500, 'Error updating ticket time: ' + error.message);
  }
};

export const assignTicketToAssetService = async (id, assetId, userId) => {
  try {
    return await ticketRepository.assignTicketToAsset(id, assetId, userId);
  } catch (error) {
    throw new ApiError(500, 'Error assigning ticket to asset: ' + error.message);
  }
};