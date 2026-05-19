import express from 'express';
import { login } from '../controllers/authController.js';
import  loginLimiter   from '../middlewares/rateLimit.middleware.js';


const router = express.Router();

router.post('/login',loginLimiter , login);

export default router;

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: sudeep.doe@acme.com
 *               password:
 *                 type: string
 *                 example: yourPassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Welcome sudeep
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 68779e59711da69c3e426045
 *                     firstName:
 *                       type: string
 *                       example: sudeep
 *                     lastName:
 *                       type: string
 *                       example: pandey
 *                     email:
 *                       type: string
 *                       example: sudeep.doe@acme.com
 *                     phoneNumber:
 *                       type: integer
 *                       example: 9876543210
 *                     clientName:
 *                       type: string
 *                       example: codec
 *                     role:
 *                       type: string
 *                       example: Client
 *                     level:
 *                       type: string
 *                       example: L1
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: [ "user:read" ]
 */