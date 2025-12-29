/**
 * API Routes - Express router setup
 */

import { Router } from 'express';
import { UserService } from '../auth/userService';
import { authenticate } from '../middleware/auth';

const router = Router();
const userService = new UserService();

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * User registration endpoint
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const user = await userService.createUser(email, password, name);
        res.status(201).json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * User login endpoint
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const token = await userService.login(email, password);
        res.json({ success: true, token });
    } catch (error) {
        res.status(401).json({ success: false, error: error.message });
    }
});

/**
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await userService.getUserById(req.user.userId);
        res.json({ success: true, user });
    } catch (error) {
        res.status(404).json({ success: false, error: error.message });
    }
});

/**
 * Update user profile
 */
router.put('/me', authenticate, async (req, res) => {
    try {
        const updates = req.body;
        const user = await userService.updateUser(req.user.userId, updates);
        res.json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * Delete user account
 */
router.delete('/me', authenticate, async (req, res) => {
    try {
        await userService.deleteUser(req.user.userId);
        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * New API route handlers - need security review
 * TODO: Add rate limiting
 * TODO: Add input validation
 * TODO: Add request logging
 */
router.post('/admin/users', async (req, res) => {
    const { action, userId } = req.body;

    if (action === 'ban') {
        await userService.updateUser(userId, { banned: true });
        res.json({ success: true });
    } else if (action === 'unban') {
        await userService.updateUser(userId, { banned: false });
        res.json({ success: true });
    }
});

export default router;
