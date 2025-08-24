// middleware/requireAdmin.js
export default function requireAdmin(req, res, next) {
  try {
    // assumes your auth middleware has already set req.user
    const role = (req.user?.role || "").toString().toLowerCase();
    if (role !== "admin") return res.status(403).json({ message: "Admins only" });
    next();
  } catch {
    return res.status(403).json({ message: "Admins only" });
  }
}
