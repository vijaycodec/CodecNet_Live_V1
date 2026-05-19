import express from 'express';
import { createRole, getAllRoles, updateRole, deleteRole, getRoleById } from '../controllers/role.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import hasPermission from '../middlewares/permission.middleware.js';

const router = express.Router();

// PATCH 34-35: Authorization middleware applied
router.post('/create', protect, hasPermission('role:create'), createRole);

router.get('/get', protect, hasPermission('role:read'), getAllRoles);

// Add root endpoint for frontend compatibility
router.get('/', protect, hasPermission('role:read'), getAllRoles);

router.put('/update/:id', protect, hasPermission('role:update'), updateRole);

router.delete('/delete/:id', protect, hasPermission('role:delete'), deleteRole);

// PATCH 2: Replace hardcoded isSuperAdmin with permission check
router.get('/get/:id', protect, hasPermission('role:read'), getRoleById);

export default router;


/**
 * @swagger
 * /api/v1/roles/create:
 *   post:
 *     summary: Create a new Role
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *                 example: Analyst
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["user:read"]
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Role created successfully
 *                 role:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 68788d61ac670b374b9b1a39
 *                     name:
 *                       type: string
 *                       example: Analyst
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["68778cf671765c70e5f0cfcd"]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-17T05:42:57.226Z
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-17T05:42:57.226Z
 *                     __v:
 *                       type: integer
 *                       example: 0
 *                 success:
 *                   type: boolean
 *                   example: true
 */


/**
 * @swagger
 * /roles/get:
 *   get:
 *     summary: Get all roles with their permissions
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: List of roles with permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Roles fetched successfully
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 68788d61ac670b374b9b1a39
 *                       name:
 *                         type: string
 *                         example: Analyst
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                               example: 68778cf671765c70e5f0cfcd
 *                             name:
 *                               type: string
 *                               example: user:read
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *             example:
 *               message: Roles fetched successfully
 *               success: true
 *               data:
 *                 - _id: "68788d61ac670b374b9b1a39"
 *                   name: "SuperAdmin"
 *                   permissions:
 *                     - _id: "68778cf671765c70e5f0cfc1"
 *                       name: "user:read"
 *                     - _id: "68778cf671765c70e5f0cfc2"
 *                       name: "user:create"
 *                     - _id: "68778cf671765c70e5f0cfc3"
 *                       name: "user:update"
 *                 - _id: "68788d61ac670b374b9b1a40"
 *                   name: "Analyst"
 *                   permissions:
 *                     - _id: "68778cf671765c70e5f0cfce"
 *                       name: "user:create"
 *                     - _id: "68778cf671765c70e5f0cfcf"
 *                       name: "user:update"
 *                 - _id: "68788d61ac670b374b9b1a41"
 *                   name: "Client"
 *                   permissions:
 *                     - _id: "68778cf671765c70e5f0cfcg"
 *                       name: "user:view"
 *                 - _id: "68788d61ac670b374b9b1a42"
 *                   name: "Admin"
 *                   permissions:
 *                     - _id: "68778cf671765c70e5f0cfch"
 *                       name: "user:delete"
 *                     - _id: "68778cf671765c70e5f0cfci"
 *                       name: "user:manage"
 */


/**
 * @swagger
 * /api/v1/roles/update/:id:
 *   put:
 *     summary: Update an existing Role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Role ID to update
 *         schema:
 *           type: string
 *           example: 64c7e342a21bd7510d49edfb
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *                 example: Client
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["user:create", "user:update", "user:read"]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Role updated successfully
 *                 role:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 64c7e342a21bd7510d49edfb
 *                     name:
 *                       type: string
 *                       example: Client
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["user:create", "user:update", "user:read"]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-17T05:42:57.226Z
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-30T10:42:15.000Z
 *                     __v:
 *                       type: integer
 *                       example: 0
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid role ID or input
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/v1/roles/delete/:id:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Role ID to delete
 *         schema:
 *           type: string
 *           example: 64c7e342a21bd7510d49edfb
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Role deleted successfully
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Role not found
 *       409:
 *         description: Role is assigned to users and cannot be deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Role is assigned to users. Cannot delete.
 *       500:
 *         description: Server error while deleting role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Server error while deleting role
 */
