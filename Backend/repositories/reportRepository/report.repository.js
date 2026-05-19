import Report from '../../models/report.model.js';
import mongoose from 'mongoose';

// Basic CRUD operations
export const createReport = async (reportData) => {
  return await Report.create(reportData);
};

export const findReportById = async (id, populateFields = []) => {
  let query = Report.findById(id);

  const defaultPopulate = ['organisation_id', 'created_by', 'updated_by'];
  const fieldsToPopulate = populateFields.length > 0 ? populateFields : defaultPopulate;

  fieldsToPopulate.forEach(field => {
    if (field === 'organisation_id') {
      query = query.populate(field, 'organisation_name client_name emails');
    } else if (field === 'created_by' || field === 'updated_by' || field === 'deleted_by') {
      query = query.populate(field, 'username full_name email');
    } else {
      query = query.populate(field);
    }
  });

  return await query;
};

export const updateReportById = async (id, updatedFields, userId = null) => {
  if (userId) {
    updatedFields.updated_by = userId;
  }
  return await Report.findByIdAndUpdate(id, updatedFields, {
    new: true,
    runValidators: true
  });
};

export const deleteReportById = async (id) => {
  return await Report.findByIdAndDelete(id);
};

// Soft delete operations
export const softDeleteReport = async (id, deletedBy) => {
  const report = await Report.findById(id);
  if (!report) return null;

  return await report.softDelete(deletedBy);
};

export const restoreReport = async (id) => {
  const report = await Report.findById(id);
  if (!report) return null;

  return await report.restore();
};

// Query operations
export const findAllReports = async (organisationId = null, includeDeleted = false) => {
  const query = {};

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  if (!includeDeleted) {
    query.is_deleted = false;
  }

  return await Report.find(query)
    .populate('organisation_id', 'organisation_name client_name emails')
    .populate('created_by', 'username full_name email')
    .sort({ createdAt: -1 });
};

export const findActiveReports = async (organisationId = null) => {
  return await Report.findActive(organisationId)
    .populate('organisation_id', 'organisation_name client_name')
    .populate('created_by', 'username full_name email')
    .sort({ createdAt: -1 });
};

export const findReportsByOrganisation = async (organisationId, includeDeleted = false) => {
  return await Report.findByOrganisation(organisationId, includeDeleted)
    .populate('created_by', 'username full_name email');
};

export const findReportsByFrequency = async (frequency, organisationId = null) => {
  const query = { frequency, is_deleted: false };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await Report.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .populate('created_by', 'username full_name email')
    .sort({ createdAt: -1 });
};

export const findReportsByTemplate = async (template, organisationId = null) => {
  const query = { template, is_deleted: false };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await Report.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .populate('created_by', 'username full_name email')
    .sort({ createdAt: -1 });
};

export const findReportsByDateRange = async (startDate, endDate, organisationId = null) => {
  const query = {
    createdAt: {
      $gte: startDate,
      $lte: endDate
    },
    is_deleted: false
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await Report.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .populate('created_by', 'username full_name email')
    .sort({ createdAt: -1 });
};

export const findReportsByPeriodRange = async (periodStart, periodEnd, organisationId = null) => {
  const query = {
    report_period_start: { $gte: periodStart },
    report_period_end: { $lte: periodEnd },
    is_deleted: false
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await Report.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .populate('created_by', 'username full_name email')
    .sort({ report_period_start: -1 });
};

export const findReportsByCreator = async (userId, organisationId = null) => {
  const query = { created_by: userId, is_deleted: false };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await Report.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .sort({ createdAt: -1 });
};

export const findReportsByPriority = async (priority, organisationId = null) => {
  const query = { priority, is_deleted: false };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await Report.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .populate('created_by', 'username full_name email')
    .sort({ createdAt: -1 });
};

// Search operations
export const searchReports = async (searchTerm, organisationId = null, limit = 20) => {
  const query = {
    $or: [
      { report_name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { template: { $regex: searchTerm, $options: 'i' } },
      { file_name: { $regex: searchTerm, $options: 'i' } }
    ],
    is_deleted: false
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await Report.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .populate('created_by', 'username full_name email')
    .limit(limit)
    .sort({ createdAt: -1 });
};

// Statistics and reporting
export const getReportStatistics = async (organisationId = null, days = 30) => {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = {
    createdAt: { $gte: cutoffDate },
    is_deleted: false
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  const totalReports = await Report.countDocuments(query);

  const reportsByFrequency = await Report.aggregate([
    { $match: query },
    { $group: { _id: '$frequency', count: { $sum: 1 } } }
  ]);

  const reportsByTemplate = await Report.aggregate([
    { $match: query },
    { $group: { _id: '$template', count: { $sum: 1 } } }
  ]);

  const reportsByPriority = await Report.aggregate([
    { $match: query },
    { $group: { _id: '$priority', count: { $sum: 1 } } }
  ]);

  const totalFileSize = await Report.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: '$file_size' } } }
  ]);

  return {
    totalReports,
    reportsByFrequency,
    reportsByTemplate,
    reportsByPriority,
    totalFileSize: totalFileSize.length > 0 ? totalFileSize[0].total : 0
  };
};

export const getReportTrends = async (organisationId = null, days = 30) => {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = {
    createdAt: { $gte: cutoffDate },
    is_deleted: false
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await Report.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

// Bulk operations
export const bulkDeleteReports = async (reportIds, deletedBy) => {
  return await Report.updateMany(
    { _id: { $in: reportIds } },
    {
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: deletedBy
    }
  );
};

export const bulkUpdateReports = async (reportIds, updateData, userId = null) => {
  if (userId) {
    updateData.updated_by = userId;
  }

  return await Report.updateMany(
    { _id: { $in: reportIds } },
    updateData
  );
};

// Validation functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateReportExists = async (id) => {
  const report = await Report.findById(id);
  return !!report && !report.is_deleted;
};

export const checkReportNameExists = async (reportName, organisationId, excludeReportId = null) => {
  const query = {
    report_name: reportName,
    organisation_id: organisationId,
    is_deleted: false
  };

  if (excludeReportId) {
    query._id = { $ne: excludeReportId };
  }

  const report = await Report.findOne(query);
  return !!report;
};

// Export aliases
export const getReportById = findReportById;
export const getReportsByOrganisation = findReportsByOrganisation;
export const getReportsByFrequency = findReportsByFrequency;
export const getReportsByTemplate = findReportsByTemplate;
