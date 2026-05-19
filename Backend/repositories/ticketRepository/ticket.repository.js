import { Ticket } from '../../models/ticket.model.js';
import mongoose from 'mongoose';

// Basic CRUD operations
export const createTicket = async (ticketData) => {
  // Set initial tracking fields
  const enhancedTicketData = {
    ...ticketData,
    status_changed_by: ticketData.created_by || ticketData.user_id,
    status_changed_at: new Date(),
    updated_by: ticketData.created_by || ticketData.user_id
  };

  // Use new + save() to trigger pre-save middleware for ticket number generation
  const ticket = new Ticket(enhancedTicketData);
  return await ticket.save();
};

export const findTicketById = async (id, populateFields = []) => {
  let query = Ticket.findById(id);
  
  const defaultPopulate = ['organisation_id', 'user_id', 'related_asset_id'];
  const fieldsToPopulate = populateFields.length > 0 ? populateFields : defaultPopulate;
  
  fieldsToPopulate.forEach(field => {
    if (field === 'organisation_id') {
      query = query.populate(field, 'organisation_name client_name emails');
    } else if (field === 'user_id') {
      query = query.populate(field, 'username full_name email');
    } else if (field === 'related_asset_id') {
      query = query.populate(field, 'asset_name asset_tag ip_address');
    } else {
      query = query.populate(field);
    }
  });
  
  return await query;
};

export const updateTicketById = async (id, updatedFields, userId = null) => {
  if (userId) {
    updatedFields.updated_by = userId;
  }
  return await Ticket.findByIdAndUpdate(id, updatedFields, { 
    new: true,
    runValidators: true 
  });
};

export const deleteTicketById = async (id) => {
  return await Ticket.findByIdAndDelete(id);
};

// Query operations
export const findAllTickets = async (organisationId = null, limit = 0, startDate = null, endDate = null) => {
  const query = {};

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  // Add date filtering by createdAt
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  return await Ticket.find(query)
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('user_id', 'username full_name email')
    .populate('created_by', 'username full_name email display_name')
    .sort({ createdAt: -1 })
    .limit(limit);
};

export const findTicketsByStatus = async (status, organisationId = null) => {
  return await Ticket.findByStatus(status, organisationId);
};

export const findTicketsByUser = async (userId, organisationId = null) => {
  const query = { user_id: userId };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await Ticket.find(query)
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('related_asset_id', 'asset_name asset_tag')
    .sort({ createdAt: -1 });
};

export const findTicketsByOrganisation = async (organisationId) => {
  return await Ticket.find({ organisation_id: organisationId })
    .populate('user_id', 'username full_name')
    .populate('related_asset_id', 'asset_name asset_tag')
    .sort({ createdAt: -1 });
};

export const findTicketBySeverity = async (severity, organisationId = null) => {
  const query = { severity };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await Ticket.find(query)
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('user_id', 'username full_name')
    .sort({ createdAt: -1 });
};

export const findTicketByNumber = async (ticketNumber) => {
  return await Ticket.findOne({ ticket_number: ticketNumber })
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('user_id', 'username full_name')
    .populate('related_asset_id', 'asset_name asset_tag ip_address');
};

// Status management
export const updateTicketStatus = async (ticketId, status, userId, statusNotes = null, resolutionType = null, resolutionNotes = null) => {
  // First get the current ticket to track previous status and first response
  const currentTicket = await Ticket.findById(ticketId);
  if (!currentTicket) {
    throw new Error('Ticket not found');
  }

  // Status progression validation
  const currentStatus = currentTicket.ticket_status;

  // Rule 1: Once resolved, cannot be changed to any other status
  if (currentStatus === 'resolved') {
    throw new Error('Cannot change status of a resolved ticket. Resolved tickets are final.');
  }

  // Rule 2: Cannot go from 'investigating' back to 'open'
  if (currentStatus === 'investigating' && status === 'open') {
    throw new Error('Cannot change status from investigating back to open. Tickets can only progress forward.');
  }

  const updateData = {
    previous_status: currentTicket.ticket_status, // Track previous status
    ticket_status: status,
    status_changed_by: userId,
    status_changed_at: new Date(),
    updated_by: userId
  };

  // Set first_response_at if this is the first status change from 'open'
  if (currentTicket.ticket_status === 'open' && status !== 'open' && !currentTicket.first_response_at) {
    updateData.first_response_at = new Date();
  }

  if (statusNotes) {
    updateData.resolution_notes = statusNotes;
  }

  // Handle resolution data when status is resolved
  if (status === 'resolved') {
    if (resolutionType) {
      updateData.resolution_type = resolutionType;
    }
    if (resolutionNotes) {
      updateData.resolution_notes = resolutionNotes;
    }
    updateData.resolved_at = new Date();
  }

  return await Ticket.findByIdAndUpdate(ticketId, updateData, { new: true });
};

export const resolveTicket = async (ticketId, resolutionNotes, resolvedBy) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return null;
  
  return await ticket.resolve(resolutionNotes, resolvedBy);
};

// Asset relationship
export const assignTicketToAsset = async (ticketId, assetId, userId = null) => {
  const updateData = { related_asset_id: assetId };

  if (userId) {
    updateData.updated_by = userId;
  }

  return await Ticket.findByIdAndUpdate(ticketId, updateData, {
    new: true,
    runValidators: true
  });
};

export const findTicketsByAsset = async (assetId) => {
  return await Ticket.find({ related_asset_id: assetId })
    .populate('organisation_id', 'organisation_name client_name')
    .populate('user_id', 'username full_name')
    .sort({ createdAt: -1 });
};

// SLA management
export const findOverdueTickets = async (organisationId = null) => {
  return await Ticket.findOverdue(organisationId);
};

export const findSLABreachedTickets = async (organisationId = null) => {
  return await Ticket.findSLABreached(organisationId);
};

export const updateTicketSLA = async (ticketId, slaDate, userId = null) => {
  const updateData = { sla_due_date: slaDate };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Ticket.findByIdAndUpdate(ticketId, updateData, { new: true });
};

// Time tracking
export const updateTicketTime = async (ticketId, estimatedHours = null, actualHours = null, userId = null) => {
  const updateData = {};
  
  if (estimatedHours !== null) {
    updateData.estimated_hours = estimatedHours;
  }
  
  if (actualHours !== null) {
    updateData.actual_hours = actualHours;
  }
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Ticket.findByIdAndUpdate(ticketId, updateData, { 
    new: true,
    runValidators: true 
  });
};

// Comments and attachments (legacy support)
export const addTicketComment = async (ticketId, userId, comment) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return null;
  
  ticket.comments.push({
    user: userId,
    comment: comment,
    createdAt: new Date()
  });
  
  return await ticket.save();
};

export const addTicketAttachment = async (ticketId, filename, url) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return null;
  
  ticket.attachments.push({
    filename: filename,
    url: url,
    uploadedAt: new Date()
  });
  
  return await ticket.save();
};

// Search operations
export const searchTickets = async (searchTerm, organisationId = null, limit = 0) => {
  const query = {
    $or: [
      { ticket_number: { $regex: searchTerm, $options: 'i' } },
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { resolution_notes: { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await Ticket.find(query)
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('user_id', 'username full_name')
    .populate('related_asset_id', 'asset_name asset_tag')
    .limit(limit)
    .sort({ createdAt: -1 });
};

// Statistics and reporting
export const getTicketStatistics = async (organisationId = null, days = 30) => {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = { createdAt: { $gte: cutoffDate } };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  const totalTickets = await Ticket.countDocuments(query);
  const openTickets = await Ticket.countDocuments({ ...query, ticket_status: 'open' });
  const resolvedTickets = await Ticket.countDocuments({ ...query, ticket_status: 'resolved' });
  const criticalTickets = await Ticket.countDocuments({ ...query, severity: 'critical' });
  const overdueTickets = await Ticket.countDocuments({
    ...query,
    due_date: { $lt: new Date() },
    ticket_status: { $ne: 'resolved' }
  });
  
  const ticketsBySeverity = await Ticket.aggregate([
    { $match: query },
    { $group: { _id: '$severity', count: { $sum: 1 } } }
  ]);
  
  const ticketsByStatus = await Ticket.aggregate([
    { $match: query },
    { $group: { _id: '$ticket_status', count: { $sum: 1 } } }
  ]);
  
  return {
    totalTickets,
    openTickets,
    resolvedTickets,
    criticalTickets,
    overdueTickets,
    ticketsBySeverity,
    ticketsByStatus,
    resolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0
  };
};

export const getTicketTrends = async (organisationId = null, days = 30) => {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = { createdAt: { $gte: cutoffDate } };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await Ticket.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [{ $eq: ['$ticket_status', 'resolved'] }, 1, 0]
          }
        }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

// Advanced queries
export const findTicketsByDateRange = async (startDate, endDate, organisationId = null) => {
  const query = {
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await Ticket.find(query)
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('user_id', 'username full_name')
    .sort({ createdAt: -1 });
};

export const findTicketsByCategory = async (category, organisationId = null) => {
  const query = { category };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await Ticket.find(query)
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('user_id', 'username full_name')
    .sort({ createdAt: -1 });
};

export const findTicketsByTags = async (tags, organisationId = null) => {
  const query = { tags: { $in: tags } };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await Ticket.find(query)
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('user_id', 'username full_name')
    .sort({ createdAt: -1 });
};

// Bulk operations
export const bulkUpdateTickets = async (ticketIds, updateData, userId = null) => {
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Ticket.updateMany(
    { _id: { $in: ticketIds } },
    updateData
  );
};

export const bulkCloseTickets = async (ticketIds, closedBy, reason = null) => {
  return await Ticket.updateMany(
    { _id: { $in: ticketIds } },
    {
      ticket_status: 'resolved',
      resolved_at: new Date(),
      resolution_notes: reason || 'Bulk closed',
      status_changed_by: closedBy,
      updated_by: closedBy
    }
  );
};

// Validation functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateTicketExists = async (id) => {
  const ticket = await Ticket.findById(id);
  return !!ticket;
};

export const checkTicketNumberExists = async (ticketNumber, excludeTicketId = null) => {
  const query = { ticket_number: ticketNumber };
  
  if (excludeTicketId) {
    query._id = { $ne: excludeTicketId };
  }
  
  const ticket = await Ticket.findOne(query);
  return !!ticket;
};

// Export aliases
export const getTicketById = findTicketById;
export const getTicketByNumber = findTicketByNumber;
export const getTicketsByUser = findTicketsByUser;
export const getTicketsByOrganisation = findTicketsByOrganisation;
export const getTicketsByStatus = findTicketsByStatus;