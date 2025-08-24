// controllers/notificationController.js
import Notification from '../models/Notification.js';

// POST /api/notifications/send  (admin/system only)
export const sendNotification = async (req, res) => {
  try {
    const { recipientId, type = 'info', message, meta = {} } = req.body;
    if (!recipientId || !message) {
      return res.status(400).json({ message: 'recipientId and message are required' });
    }

    const notification = await Notification.create({
      recipient: recipientId,
      type,
      message,
      meta,
    });

    res.status(201).json({ message: 'Notification sent', notification });
  } catch (error) {
    res.status(500).json({ message: 'Error sending notification', error: error.message });
  }
};

// GET /api/notifications  (logged-in user's notifications)
// Optional: ?unread=true  or  ?page=1&pageSize=20
export const getMyNotifications = async (req, res) => {
  try {
    const { unread, page, pageSize } = req.query;

    const q = { recipient: req.user._id };
    if (String(unread).toLowerCase() === 'true') q.isRead = false;

    // Paged response (returns an object with data + totals)
    if (page && pageSize) {
      const p = Math.max(1, Number(page) || 1);
      const sz = Math.min(100, Math.max(1, Number(pageSize) || 20));

      const [rows, total, unreadCount] = await Promise.all([
        Notification.find(q).sort({ createdAt: -1 }).skip((p - 1) * sz).limit(sz),
        Notification.countDocuments({ recipient: req.user._id }),
        Notification.countDocuments({ recipient: req.user._id, isRead: false }),
      ]);

      return res.status(200).json({ data: rows, page: p, pageSize: sz, total, unreadCount });
    }

    // Default (simple array for compatibility)
    const notifications = await Notification.find(q).sort({ createdAt: -1 });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// PATCH /api/notifications/:id/read  (mark one as read)
export const markNotificationAsRead = async (req, res) => {
  try {
    const n = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!n) return res.status(404).json({ message: 'Notification not found' });

    if (!n.isRead) {
      n.isRead = true;
      await n.save();
    }
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification', error: error.message });
  }
};

// PATCH /api/notifications/read-all  (mark all as read)
export const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    res
      .status(200)
      .json({ message: 'All notifications marked as read', modified: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
};

// GET /api/notifications/unread-count  (badge count)
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req, res) => {
  try {
    const n = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });
    if (!n) return res.status(404).json({ message: 'Notification not found' });
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
};
