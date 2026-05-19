import express from 'express';
import {
  generateReport,
  getAllReports,
  downloadReport,
  deleteReport,
  listComplianceReports,        // PATCH 43
  downloadComplianceReport       // PATCH 43
} from '../controllers/reports.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizePermissions } from '../middlewares/authorization.middleware.js';
import { organisationScope } from '../middlewares/organisationScope.middleware.js';
import { fetchClientCred } from '../middlewares/fetchClientCredentials.js';

const router = express.Router();

// PATCH 43: Public download route (token-based, no JWT auth)
// Must be registered BEFORE authenticateToken middleware
router.get('/download/compliance/:filename',
  downloadComplianceReport
);

// Apply authentication middlewares to all other routes
router.use(authenticateToken);
router.use(organisationScope({}));
router.use(fetchClientCred);

/**
 * @route   POST /api/reports/generate
 * @desc    Generate a new report
 * @access  Private (Requires reports:create permission)
 */
router.post('/generate',
  authorizePermissions(['reports:create']),
  generateReport
);

/**
 * @route   GET /api/reports
 * @desc    Get all reports for the organization
 * @access  Private (Requires reports:read permission)
 */
router.get('/',
  authorizePermissions(['reports:read']),
  getAllReports
);

/**
 * @route   GET /api/reports/:id/download
 * @desc    Download a specific report
 * @access  Private (Requires reports:download permission)
 */
router.get('/:id/download',
  authorizePermissions(['reports:download']),
  downloadReport
);

/**
 * @route   DELETE /api/reports/:id
 * @desc    Delete (soft delete) a report
 * @access  Private (Requires reports:delete permission)
 */
router.delete('/:id',
  authorizePermissions(['reports:delete']),
  deleteReport
);

// PATCH 43: List compliance reports with signed URLs
/**
 * @route   GET /api/reports/compliance
 * @desc    List static compliance reports with signed download URLs
 * @access  Private (Requires reports:read permission)
 */
router.get('/compliance',
  authorizePermissions(['reports:read']),
  listComplianceReports
);

export default router;
