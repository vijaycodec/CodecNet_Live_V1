import Assignment from '../../models/assignment.model.js';
import mongoose from 'mongoose';

// Basic CRUD operations
export const createAssignment = async (assignmentData) => {
  return await Assignment.create(assignmentData);
};

export const findAssignmentById = async (id, populateFields = []) => {
  let query = Assignment.findById(id);
  
  const defaultPopulate = ['ticket_id', 'assigned_to', 'assigned_by', 'escalated_from'];
  const fieldsToPopulate = populateFields.length > 0 ? populateFields : defaultPopulate;
  
  fieldsToPopulate.forEach(field => {
    if (field === 'ticket_id') {
      query = query.populate(field, 'ticket_number title severity ticket_status');
    } else if (field === 'assigned_to' || field === 'assigned_by') {
      query = query.populate(field, 'username full_name email');
    } else {
      query = query.populate(field);
    }
  });
  
  return await query;
};

export const updateAssignmentById = async (id, updatedFields, userId = null) => {
  if (userId) {
    updatedFields.updated_by = userId;
  }
  return await Assignment.findByIdAndUpdate(id, updatedFields, { 
    new: true,
    runValidators: true 
  });
};

export const deleteAssignmentById = async (id) => {
  return await Assignment.findByIdAndDelete(id);
};

// Query operations
export const findAssignmentsByTicket = async (ticketId) => {
  return await Assignment.findByTicket(ticketId);
};

export const findAssignmentsByUser = async (userId, includeCompleted = false) => {
  const query = { assigned_to: userId };
  
  if (!includeCompleted) {
    query.status = { $nin: ['completed', 'cancelled', 'declined'] };
  }
  
  return await Assignment.find(query)
    .populate('ticket_id', 'ticket_number title severity ticket_status due_date')
    .populate('assigned_by', 'username full_name')
    .sort({ createdAt: -1 });
};

export const findActiveAssignmentsForUser = async (userId) => {
  return await Assignment.findActiveForUser(userId);
};

export const findAssignmentsByStatus = async (status, userId = null) => {
  return await Assignment.findByStatus(status, userId);
};

export const findOverdueAssignments = async (userId = null) => {
  return await Assignment.findOverdue(userId);
};

// Assignment workflow operations
export const acceptAssignment = async (assignmentId, userId, notes = null) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) return null;
  
  return await assignment.accept(userId, notes);
};

export const startAssignmentWork = async (assignmentId, userId, notes = null) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) return null;
  
  return await assignment.startWork(userId, notes);
};

export const completeAssignment = async (assignmentId, userId, completionNotes = null) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) return null;
  
  return await assignment.complete(userId, completionNotes);
};

export const declineAssignment = async (assignmentId, userId, reason = null) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) return null;
  
  return await assignment.decline(userId, reason);
};

export const escalateAssignment = async (assignmentId, newAssignee, escalatedBy, reason = null) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) return null;
  
  return await assignment.escalate(newAssignee, escalatedBy, reason);
};

// Work logging
export const addWorkLogEntry = async (assignmentId, description, hoursWorked = 0, userId = null) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) return null;
  
  return await assignment.addWorkLog(description, hoursWorked, userId);
};

export const updateWorkHours = async (assignmentId, actualHours, userId = null) => {
  const updateData = { actual_hours: actualHours };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Assignment.findByIdAndUpdate(assignmentId, updateData, { new: true });
};

// Assignment type operations
export const findPrimaryAssignment = async (ticketId) => {
  return await Assignment.findOne({
    ticket_id: ticketId,
    assignment_type: 'primary',
    status: { $nin: ['cancelled', 'declined'] }
  }).populate('assigned_to', 'username full_name email');
};

export const findAssignmentsByType = async (ticketId, assignmentType) => {
  return await Assignment.find({
    ticket_id: ticketId,
    assignment_type: assignmentType
  }).populate('assigned_to', 'username full_name email');
};

// Statistics and reporting
export const getAssignmentStatistics = async (userId = null, days = 30) => {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = { createdAt: { $gte: cutoffDate } };
  
  if (userId) {
    query.assigned_to = userId;
  }
  
  const totalAssignments = await Assignment.countDocuments(query);
  const completedAssignments = await Assignment.countDocuments({ ...query, status: 'completed' });
  const overdueAssignments = await Assignment.countDocuments({
    ...query,
    due_date: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] }
  });
  const pendingAssignments = await Assignment.countDocuments({ ...query, status: 'pending' });
  const inProgressAssignments = await Assignment.countDocuments({ ...query, status: 'in_progress' });
  
  return {
    totalAssignments,
    completedAssignments,
    overdueAssignments,
    pendingAssignments,
    inProgressAssignments,
    completionRate: totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0
  };
};

export const getAssignmentWorkload = async (userId) => {
  const activeAssignments = await Assignment.countDocuments({
    assigned_to: userId,
    status: { $in: ['pending', 'accepted', 'in_progress'] }
  });
  
  const overdueAssignments = await Assignment.countDocuments({
    assigned_to: userId,
    due_date: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] }
  });
  
  // Calculate total estimated hours for active assignments
  const activeAssignmentsWithHours = await Assignment.find({
    assigned_to: userId,
    status: { $in: ['pending', 'accepted', 'in_progress'] },
    estimated_hours: { $exists: true, $ne: null }
  });
  
  const totalEstimatedHours = activeAssignmentsWithHours.reduce((sum, assignment) => {
    return sum + (parseFloat(assignment.estimated_hours.toString()) || 0);
  }, 0);
  
  return {
    activeAssignments,
    overdueAssignments,
    totalEstimatedHours
  };
};

// Search operations
export const searchAssignments = async (searchTerm, userId = null, limit = 20) => {
  const pipeline = [
    {
      $lookup: {
        from: 'tickets',
        localField: 'ticket_id',
        foreignField: '_id',
        as: 'ticket'
      }
    },
    {
      $unwind: '$ticket'
    },
    {
      $match: {
        $or: [
          { 'ticket.ticket_number': { $regex: searchTerm, $options: 'i' } },
          { 'ticket.title': { $regex: searchTerm, $options: 'i' } },
          { assignment_notes: { $regex: searchTerm, $options: 'i' } },
          { completion_notes: { $regex: searchTerm, $options: 'i' } }
        ]
      }
    }
  ];
  
  if (userId) {
    pipeline.push({ $match: { assigned_to: mongoose.Types.ObjectId(userId) } });
  }
  
  pipeline.push(
    { $sort: { createdAt: -1 } },
    { $limit: limit }
  );
  
  return await Assignment.aggregate(pipeline);
};

// Bulk operations
export const bulkUpdateAssignments = async (assignmentIds, updateData, userId = null) => {
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Assignment.updateMany(
    { _id: { $in: assignmentIds } },
    updateData
  );
};

export const reassignBulkAssignments = async (assignmentIds, newAssignee, reassignedBy) => {
  return await Assignment.updateMany(
    { _id: { $in: assignmentIds } },
    {
      assigned_to: newAssignee,
      status: 'pending',
      assigned_by: reassignedBy,
      updated_by: reassignedBy
    }
  );
};

// Validation functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateAssignmentExists = async (id) => {
  const assignment = await Assignment.findById(id);
  return !!assignment;
};

export const checkUserCanAcceptAssignment = async (assignmentId, userId) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) return { canAccept: false, reason: 'Assignment not found' };
  
  if (assignment.assigned_to.toString() !== userId.toString()) {
    return { canAccept: false, reason: 'Assignment not assigned to user' };
  }
  
  if (assignment.status !== 'pending') {
    return { canAccept: false, reason: 'Assignment is not in pending status' };
  }
  
  return { canAccept: true };
};

// Export aliases
export const getAssignmentById = findAssignmentById;
export const getUserAssignments = findAssignmentsByUser;
export const getTicketAssignments = findAssignmentsByTicket;