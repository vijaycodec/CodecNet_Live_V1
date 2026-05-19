// routes/user.routes.js
import express from 'express';
import { changePassword, resetPassword } from '../controllers/changePasswordController.js';
import { protect } from '../middlewares/auth.middleware.js';
import { isSuperAdmin } from '../middlewares/role.middleware.js';

import hasPermission from '../middlewares/permission.middleware.js';

const router = express.Router();

// User changes their own password
router.post("/change-password", protect, hasPermission('password:change'), changePassword);

// SuperAdmin resets password for another user
router.post("/reset-password/:userId", protect, isSuperAdmin, resetPassword);

export default router;

