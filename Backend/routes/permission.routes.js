import express from 'express';
import { createPermission, getAllPermissions, updatePermission, deletePermission } from '../controllers/permission.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import hasPermission from '../middlewares/permission.middleware.js';

const router = express.Router();

// PATCH 34-35: Authorization middleware applied
router.post('/create', protect, hasPermission('permission:create'), createPermission);

router.get('/all', protect, hasPermission('permission:read'), getAllPermissions);

// Add root endpoint for frontend compatibility
router.get('/', protect, hasPermission('permission:read'), getAllPermissions);

// PATCH 15 (SECURITY): Test endpoint removed - use authenticated endpoints only
// If debugging is needed in development, check logs or use /api/permissions with valid auth

// PATCH 2: Replace hardcoded isSuperAdmin with permission check
router.put('/update/:id', protect, hasPermission('permission:update'), updatePermission);

// PATCH 2: Replace hardcoded isSuperAdmin with permission check
router.delete('/delete/:id', protect, hasPermission('permission:delete'), deletePermission);

export default router;


/**
 * @swagger
 * /api/v1/permissions/create:
 *   post:
 *     summary: Create a new permission
 *     description: Creates a new permission if it doesn't already exist.
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []  # ⭐ Secured endpoint with Bearer token (JWT)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: view_user
 *     responses:
 *       201:
 *         description: Permission created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Permission created successfully
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 permission:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 64e30c7b6f3c5293b4fe3abc
 *                     name:
 *                       type: string
 *                       example: view_user
 *       400:
 *         description: Bad request – Invalid or missing input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Permission name is required and must be a string
 *                 success:
 *                   type: boolean
 *                   example: false
 *       409:
 *         description: Conflict – Permission already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Permission with this name already exists
 *                 success:
 *                   type: boolean
 *                   example: false
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal Server Error
 *                 error:
 *                   type: string
 *                   example: Something went wrong
 *                 success:
 *                   type: boolean
 *                   example: false
 */


/**
 * @swagger
 * /api/v1/permissions/update/{id}:
 *   put:
 *     summary: Update an existing permission
 *     description: Updates the name of a permission by ID. Only authorized users can update permissions.
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []  # JWT Bearer token required
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the permission to update
 *         schema:
 *           type: string
 *           example: 64e30c7b6f3c5293b4fe3abc
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: edit_user
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Permission updated successfully
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 permission:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *       400:
 *         description: Bad request – invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Permission name is required and must be a string
 *                 success:
 *                   type: boolean
 *                   example: false
 *       404:
 *         description: Permission not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Permission not found
 *                 success:
 *                   type: boolean
 *                   example: false
 *       409:
 *         description: Duplicate permission name
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Another permission with this name already exists
 *                 success:
 *                   type: boolean
 *                   example: false
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal Server Error
 *                 error:
 *                   type: string
 *                 success:
 *                   type: boolean
 *                   example: false
 */
