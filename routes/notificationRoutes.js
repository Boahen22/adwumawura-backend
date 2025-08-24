// routes/notificationRoutes.js
import express from 'express';
import {
  sendNotification,
  getMyNotifications,
  markNotificationAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
} from '../controllers/notificationController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin/system can send a manual notification
router.post('/send', protect, isAdmin, sendNotification);

// Unread badge count
router.get('/unread-count', protect, getUnreadCount);

// List my notifications (supports ?unread=true and/or pagination)
router.get('/', protect, getMyNotifications);

// Mark all as read
router.patch('/read-all', protect, markAllAsRead);

// Mark a single notification as read
router.patch('/:id/read', protect, markNotificationAsRead);

// Delete one notification
router.delete('/:id', protect, deleteNotification);

export default router;
