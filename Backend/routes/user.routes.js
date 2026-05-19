import express from "express";
import {
  createUser,
  getAllUsers,
  getActiveUsers,
  getUserById,
  updateUser,
  updateProfile,
  changePassword,
  forcePasswordChange,
  toggleUserStatus,
  unlockUser,
  deleteUser,
  restoreUser,
  searchUsers,
  getUsersByRole,
  getUsersByOrganisation,
  getUserStatistics,
  getCurrentUser,
} from "../controllers/user.controller.js";
import {
  createUserValidator,
  updateUserValidator,
  updateProfileValidator,
  changePasswordValidator,
  deleteUserValidator,
  userQueryValidator,
  userIdValidator,
  bulkUserActionValidator,
  userStatsQueryValidator,
} from "../validators/user.validator.js";
import { validateRequest } from "../middlewares/validation.middleware.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authorizePermissions } from "../middlewares/authorization.middleware.js";
import { organisationScope } from "../middlewares/organisationScope.middleware.js";
import { rateLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// User CRUD Operations

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private (Admin, HR roles)
 * @permissions user:create
 */
// PATCH 22: Use singular permission names (user:create not users:create)
router.post(
  "/",
  authorizePermissions(["user:create"]),
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), // 10 user creations per 15 minutes
  validateRequest(createUserValidator, "body"),
  createUser
);

/**
 * @route   GET /api/users
 * @desc    Get all users with filtering and pagination
 * @access  Private (Admin, HR, Manager roles)
 * @permissions user:read
 */
// router.get(
//   "/",
//   authorizePermissions(["user:read"]),
//   organisationScope, // Ensure users only see users from their organisation
//   validateRequest(userQueryValidator, "query"),
//   getAllUsers
// );
// PATCH 22: Use singular permission names
router.get(
  "/",
  authorizePermissions(["user:read"]),
  // Corrected line: added parentheses to call the function
  organisationScope(),
  validateRequest(userQueryValidator, "query"),
  getAllUsers
);

/**
 * @route   GET /api/users/active
 * @desc    Get all active users
 * @access  Private (Admin, HR, Manager roles)
 * @permissions user:read
 */
// PATCH 22: Use singular permission names
router.get(
  "/active",
  authorizePermissions(["user:read"]),
  organisationScope,
  validateRequest(userQueryValidator, "query"),
  getActiveUsers
);

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private (All authenticated users)
 */
router.get("/me", getCurrentUser);

/**
 * @route   GET /api/users/search
 * @desc    Search users by name, email, or username
 * @access  Private (Admin, HR, Manager roles)
 * @permissions user:read
 */
router.get(
  "/search",
  authorizePermissions(["user:read"]),
  organisationScope,
  validateRequest(userQueryValidator, "query"),
  searchUsers
);

/**
 * @route   GET /api/users/statistics
 * @desc    Get user statistics and analytics
 * @access  Private (Admin, Manager roles)
 * @permissions user:analytics
 */
router.get(
  "/statistics",
  authorizePermissions(["user:analytics"]),
  organisationScope,
  validateRequest(userStatsQueryValidator, "query"),
  getUserStatistics
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin, HR, Manager roles, or own profile)
 * @permissions user:read (or own profile)
 */
router.get(
  "/:id",
  validateRequest(userIdValidator, "params"),
  // Custom middleware to allow users to view their own profile
  (req, res, next) => {
    if (req.params.id === req.user.id) {
      return next(); // Allow users to view their own profile
    }
    // Otherwise, require users:read permission
    return authorizePermissions(["user:read"])(req, res, next);
  },
  organisationScope,
  getUserById
);

/**
 * @route   PUT /api/users/me/profile
 * @desc    Update current user's profile
 * @access  Private (All authenticated users)
 */
router.put(
  "/me/profile",
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 profile updates per 15 minutes
  validateRequest(updateProfileValidator, "body"),
  updateProfile
);

/**
 * @route   POST /api/users/me/change-password
 * @desc    Change current user's password
 * @access  Private (All authenticated users)
 */
router.post(
  "/me/change-password",
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 3 }), // 3 password changes per 15 minutes
  validateRequest(changePasswordValidator, "body"),
  changePassword
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user by ID
 * @access  Private (Admin, HR roles)
 * @permissions user:update
 */
router.put(
  "/:id",
  authorizePermissions(["user:update"]),
  organisationScope(),
  validateRequest(userIdValidator, "params"),
  validateRequest(updateUserValidator, "body"),
  updateUser
);

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Toggle user active/inactive status
 * @access  Private (Admin, HR roles)
 * @permissions user:update
 */
router.patch(
  "/:id/status",
  authorizePermissions(["user:update"]),
  organisationScope,
  validateRequest(userIdValidator, "params"),
  toggleUserStatus
);

/**
 * @route   POST /api/users/:id/force-password-change
 * @desc    Force user to change password on next login
 * @access  Private (Admin, HR roles)
 * @permissions user:update
 */
router.post(
  "/:id/force-password-change",
  authorizePermissions(["user:update"]),
  organisationScope,
  validateRequest(userIdValidator, "params"),
  forcePasswordChange
);

/**
 * @route   POST /api/users/:id/unlock
 * @desc    Unlock user account (remove account lock)
 * @access  Private (Admin, HR roles)
 * @permissions user:update
 */
router.post(
  "/:id/unlock",
  authorizePermissions(["user:update"]),
  organisationScope,
  validateRequest(userIdValidator, "params"),
  unlockUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Soft delete user
 * @access  Private (Admin roles only)
 * @permissions user:delete
 */
router.delete(
  "/:id",
  authorizePermissions(["user:delete"]),
  organisationScope(),
  validateRequest(userIdValidator, "params"),
  validateRequest(deleteUserValidator, "body"),
  deleteUser
);

/**
 * @route   POST /api/users/:id/restore
 * @desc    Restore soft deleted user
 * @access  Private (Admin roles only)
 * @permissions user:restore
 */
router.post(
  "/:id/restore",
  authorizePermissions(["user:restore"]),
  organisationScope,
  validateRequest(userIdValidator, "params"),
  restoreUser
);

/**
 * @route   GET /api/users/role/:role_id
 * @desc    Get users by role
 * @access  Private (Admin, HR, Manager roles)
 * @permissions user:read
 */
router.get(
  "/role/:role_id",
  authorizePermissions(["user:read"]),
  organisationScope,
  validateRequest(
    userIdValidator.keys({ role_id: userIdValidator.extract("id") }),
    "params"
  ),
  validateRequest(userQueryValidator, "query"),
  getUsersByRole
);

/**
 * @route   GET /api/users/organisation/:organisation_id
 * @desc    Get users by organisation (Admin only)
 * @access  Private (Admin only)
 * @permissions user:read, organisation:read
 */
router.get(
  "/organisation/:organisation_id",
  authorizePermissions(["user:read", "organisation:read"]),
  validateRequest(
    userIdValidator.keys({ organisation_id: userIdValidator.extract("id") }),
    "params"
  ),
  validateRequest(userQueryValidator, "query"),
  getUsersByOrganisation
);

// Health check
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "User service is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;

/**
 * @swagger
 * /api/v1/users/create:
 *   post:
 *     summary: Create a new User
 *     tags: [Users(Only Super Admin can Access)]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - clientName
 *               - email
 *               - phoneNumber
 *               - password
 *               - role
 *               - is_active
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Vijay
 *               lastName:
 *                 type: string
 *                 example: Pratap
 *               clientName:
 *                 type: string
 *                 example: codec
 *               email:
 *                 type: string
 *                 example: vijaycodec@gmail.com
 *               phoneNumber:
 *                 type: integer
 *                 example: 9876543210
 *               password:
 *                 type: string
 *                 example: Vijay@12345
 *               role:
 *                 type: string
 *                 description: MongoDB ObjectId of the role (e.g., Client role)
 *                 example: 68779775e85ff5d56b1b62db
 *               level:
 *                 type: string
 *                 description: Required only for Client roles (L1, L2, L3)
 *                 example: L3
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 687882e0fa5079b58166dafd
 *                     firstName:
 *                       type: string
 *                       example: Vijay
 *                     lastName:
 *                       type: string
 *                       example: Pratap
 *                     email:
 *                       type: string
 *                       example: vijaycodec@gmail.com
 *                     role:
 *                       type: string
 *                       example: Client
 *                     level:
 *                       type: string
 *                       example: L3
 *                     clientName:
 *                       type: string
 *                       example: Codec Netwoks
 *                     is_active:
 *                       type: boolean
 *                       example: true
 */

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get list of all users
 *     tags: [Users(Only Super Admin can Access)]
 *     responses:
 *       200:
 *         description: List of all users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Users fetched successfully
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
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       clientName:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phoneNumber:
 *                         type: number
 *                       level:
 *                         type: string
 *                       is_active:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       role:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           permissions:
 *                             type: array
 *                             items:
 *                               type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                   example:
 *                     - _id: "68778cf671765c70e5f0cfd6"
 *                       firstName: "Admin"
 *                       lastName: "Root"
 *                       clientName: "SIEM Org"
 *                       email: "superadmin@example.com"
 *                       phoneNumber: 9999999999
 *                       level: "L1"
 *                       is_active: true
 *                       createdAt: "2025-07-16T11:28:54.991Z"
 *                       updatedAt: "2025-07-16T11:28:54.991Z"
 *                       role:
 *                         _id: "68778cf671765c70e5f0cfd4"
 *                         name: "SuperAdmin"
 *                         permissions: ["68778cf671765c70e5f0cfcc", "68778cf671765c70e5f0cfcd"]
 *                         createdAt: "2025-07-16T11:28:54.920Z"
 *                         updatedAt: "2025-07-16T11:28:54.920Z"
 *                     - _id: "68778cf671765c70e5f0cfd7"
 *                       firstName: "Client"
 *                       lastName: "User"
 *                       clientName: "Acme Corp"
 *                       email: "client@example.com"
 *                       phoneNumber: 8888888888
 *                       level: "L2"
 *                       is_active: true
 *                       createdAt: "2025-07-16T11:30:12.991Z"
 *                       updatedAt: "2025-07-16T11:30:12.991Z"
 *                       role:
 *                         _id: "68778cf671765c70e5f0cfd5"
 *                         name: "Client"
 *                         permissions: ["68778cf671765c70e5f0cfce"]
 *                         createdAt: "2025-07-16T11:28:54.920Z"
 *                         updatedAt: "2025-07-16T11:28:54.920Z"
 */

/**
 * @swagger
 * /api/v1/users/:id:
 *   put:
 *     summary: Update an existing user
 *     tags: [Users(Only Super Admin can Access)]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the user to update
 *         schema:
 *           type: string
 *           example: 687882e0fa5079b58166dafd
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - clientName
 *               - email
 *               - phoneNumber
 *               - role
 *               - level
 *               - is_active
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Vijay
 *               lastName:
 *                 type: string
 *                 example: Pratap
 *               clientName:
 *                 type: string
 *                 example: SecureTech Pvt Ltd
 *               email:
 *                 type: string
 *                 example: vijay@example.com
 *               phoneNumber:
 *                 type: integer
 *                 example: 9876543210
 *               role:
 *                 type: string
 *                 description: MongoDB ObjectId of the role (e.g., Client role)
 *                 example: 68779775e85ff5d56b1b62db
 *               level:
 *                 type: string
 *                 description: Required only for Client roles (L1, L2, L3)
 *                 example: L3
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User updated successfully
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 687882e0fa5079b58166dafd
 *                     firstName:
 *                       type: string
 *                       example: Vijay
 *                     lastName:
 *                       type: string
 *                       example: Pratap
 *                     clientName:
 *                       type: string
 *                       example: SecureTech Pvt Ltd
 *                     email:
 *                       type: string
 *                       example: vijay@example.com
 *                     phoneNumber:
 *                       type: integer
 *                       example: 9876543210
 *                     role:
 *                       type: string
 *                       example: 68779775e85ff5d56b1b62db
 *                     level:
 *                       type: string
 *                       example: L3
 *                     is_active:
 *                       type: boolean
 *                       example: true
 */

/**
 * @swagger
 * /api/v1/users/status/:id:
 *   patch:
 *     summary: Toggle user's active status (true/false)
 *     tags: [Users(Only Super Admin can Access)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: 68779775e85ff5d56b1b62db
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User status toggled successfully
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
 *                   example: User status updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 64b2bc92a98e0c3a3db75990
 *                     is_active:
 *                       type: boolean
 *                       example: false
 */

/**
 * @swagger
 * /api/v1/users/profile/:id:
 *   put:
 *     summary: Update user profile
 *     description: Logged-in users can update their own profile.
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to update (must match logged-in user)
 *         schema:
 *           type: string
 *           example: 64d2f6a97d3ef428b6b6c123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phoneNumber:
 *                 type: string
 *                 example: +919898989898
 *               clientName:
 *                 type: string
 *                 example: Acme Corp
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: Profile updated successfully
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 64d2f6a97d3ef428b6b6c123
 *                     firstName:
 *                       type: string
 *                       example: John
 *                     lastName:
 *                       type: string
 *                       example: Doe
 *                     email:
 *                       type: string
 *                       example: john@example.com
 *                     phoneNumber:
 *                       type: string
 *                       example: +919898989898
 *                     clientName:
 *                       type: string
 *                       example: Acme Corp
 *       400:
 *         description: Invalid user ID in route
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
 *                   example: Invalid user ID in route
 *       403:
 *         description: Access denied (trying to update another user’s profile)
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
 *                   example: Access denied. Cannot update other profiles.
 *       404:
 *         description: User not found
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
 *                   example: User not found
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 *                 error:
 *                   type: string
 *                   example: Unexpected token ...
 */

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Fetch a user’s details using their unique ID. Requires authentication.
 *     tags: [Users (Only Super Admin can Access)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the user to retrieve
 *         schema:
 *           type: string
 *           example: 6889ba30327c86a72f863d3f
 *     responses:
 *       200:
 *         description: User fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User fetched successfully
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 6889ba30327c86a72f863d3f
 *                     firstName:
 *                       type: string
 *                       example: ClientOne
 *                     lastName:
 *                       type: string
 *                       example: clientsurename
 *                     clientName:
 *                       type: string
 *                       example: 9012534455
 *                     email:
 *                       type: string
 *                       example: client1@gmail.com
 *                     phoneNumber:
 *                       type: number
 *                       example: 9012534455
 *                     password:
 *                       type: string
 *                       example: [bcrypt hashed password - not shown for security]
 *                     level:
 *                       type: string
 *                       example: L1
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-30T06:22:40.100Z
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-31T11:29:34.423Z
 *                     __v:
 *                       type: number
 *                       example: 0
 *                     role:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: 6889b8638bcf44244d9cf913
 *                         name:
 *                           type: string
 *                           example: Client
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example:
 *                             - 6889b69f8bcf44244d9cf8d2
 *                             - 6889b65f8bcf44244d9cf8c3
 *                             - 6889b6368bcf44244d9cf8aa
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                           example: 2025-07-30T06:14:59.787Z
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                           example: 2025-07-30T06:14:59.787Z
 *                         __v:
 *                           type: number
 *                           example: 0
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not found
 *                 success:
 *                   type: boolean
 *                   example: false
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Failed to fetch user
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Error message
 */

/**
 * @swagger
 * /api/v1/users/:id:
 *   delete:
 *     summary: Delete a user by ID
 *     description: Deletes a user from the database using their unique ID. Requires authentication and appropriate permissions.
 *     tags: [Users(Only Super Admin can Access)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the user to delete
 *         schema:
 *           type: string
 *           example: 64ae12132ad49363d4db3c57
 *     responses:
 *       200:
 *         description: User deleted successfully
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
 *                   example: User deleted successfully
 *       400:
 *         description: Invalid user ID
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
 *                   example: Invalid user ID
 *       404:
 *         description: User not found
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
 *                   example: User not found
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 *                 error:
 *                   type: string
 *                   example: Detailed error message
 */
