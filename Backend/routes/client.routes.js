// routes/user.routes.js
import express from 'express';
import { createClient, updateClient, getClientById, getAllClients, deleteClient} from '../controllers/clientController.js';
import { accessClientDashboard } from '../controllers/superadmin.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import clientSchema from '../validations/client.validation.js';
import hasPermission from '../middlewares/permission.middleware.js';

const router = express.Router();

// PATCH 34-35: Authorization middleware already applied

router.post('/create', protect, hasPermission('client:create'), validate(clientSchema), createClient);

router.put('/update/:id', protect, hasPermission('client:update'), validate(clientSchema), updateClient);

router.get('/all', protect, hasPermission('client:read'), getAllClients);

router.delete('/delete/:id', protect, hasPermission('client:delete'), deleteClient);

router.get('/get/:id', protect, hasPermission('client:read'), getClientById);

export default router;