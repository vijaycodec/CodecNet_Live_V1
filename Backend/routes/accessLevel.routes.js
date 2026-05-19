import express from 'express';
import { createAccessLevel, getAllAccessLevels,updateAccessLevel,deleteAccessLevel } from '../controllers/accesslevelController.js';
import { protect } from '../middlewares/auth.middleware.js';
import { isSuperAdmin } from '../middlewares/role.middleware.js';
import hasPermission from '../middlewares/permission.middleware.js';

const router = express.Router();
router.post('/create', protect, hasPermission('level:create'), createAccessLevel);
// router.get('/all', protect, isSuperAdmin, getAllPermissions);
// router.put('/update/:id', protect, isSuperAdmin, updatePermission);
// router.delete('/delete/:id', protect, isSuperAdmin, deletePermission);

export default router;
