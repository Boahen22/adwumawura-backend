import path from "path";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import Notification from "../models/Notification.js";

/** Create notification without blocking the request lifecycle. */
async function notify(recipient, type, message, meta = {}) {
  try {
    await Notification.create({ recipient, type, message, meta });
  } catch {
    // Do not block on notification errors
  }
}

/** Turn whatever is stored in `cv` into a public URL like:
 *  http(s)://host/uploads/cv/filename.ext
 */
function toPublicCvUrl(req, storedPath) {
  if (!storedPath) return null;

  // Normalize slashes and try to cut from "uploads/..."
  let rel = String(storedPath).replace(/\\/g, "/");
  const i = rel.toLowerCase().lastIndexOf("/uploads/");
  if (i !== -1) rel = rel.slice(i + 1);          // "uploads/…"
  if (!rel.startsWith("uploads/")) {
    // Fall back: if only filename, assume uploads/cv/
    const base = "uploads/cv/";
    rel = rel.includes("/") ? rel : base + rel;
  }

  const origin = `${req.protocol}://${req.get("host")}`;
  return `${origin}/${rel}`;
}

// POST /api/applications/:jobId
export const applyForJob = async (req, res) => {
  try {
    const { coverLetter = "" } = req.body;
    const { jobId } = req.params;

    if (req.user.role !== "jobseeker") {
      return res.status(403).json({ message: "Only jobseekers can apply for jobs" });
    }

    const job = await Job.findById(jobId).populate("postedBy");
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status && job.status !== "open") {
      return res.status(400).json({ message: "This job is closed" });
    }

    const exists = await Application.findOne({ job: jobId, applicant: req.user._id });
    if (exists) return res.status(400).json({ message: "You have already applied for this job" });

    // Optional CV file (multer attaches at req.file)
    let cvPath =
      req.file?.path || (Array.isArray(req.files) && req.files[0]?.path) || null;
    if (cvPath) cvPath = cvPath.replace(/\\/g, "/"); // store normalized

    const application = await Application.create({
      job: jobId,
      applicant: req.user._id,
      coverLetter: String(coverLetter),
      cv: cvPath,
    });

    // Notify employer
    await notify(
      job.postedBy._id,
      "info",
      `${req.user.name || "A candidate"} applied for your job: "${job.title}"`,
      {
        jobId: String(job._id),
        applicationId: String(application._id),
        applicantId: String(req.user._id),
      }
    );

    // Notify applicant
    await notify(req.user._id, "success", `Your application for "${job.title}" was submitted.`, {
      jobId: String(job._id),
      applicationId: String(application._id),
    });

    // include a usable URL in the response too
    const appObj = application.toObject();
    appObj.cvUrl = toPublicCvUrl(req, appObj.cv);

    res.status(201).json({ message: "Application submitted", application: appObj });
  } catch (error) {
    console.error("Application error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/applications/job/:jobId
export const getApplicationsForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (String(job.postedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized to view applications for this job" });
    }

    // IMPORTANT: also return phone & skills so the card can show them
    const applications = await Application.find({ job: jobId })
      .populate("applicant", "name email phone skills")
      .sort({ createdAt: -1 });

    // Attach a public CV URL for each application
    const out = applications.map((a) => {
      const o = a.toObject();
      o.cvUrl = toPublicCvUrl(req, o.cv);
      return o;
    });

    res.json(out);
  } catch (error) {
    console.error("Get applications error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/applications/my
export const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ applicant: req.user._id })
      .populate("job", "title location")
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error("Get my applications error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/applications/:applicationId/status
export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const newStatus = String(req.body.status || "").toLowerCase();

    const allowed = ["pending", "reviewed", "accepted", "rejected"];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const application = await Application.findById(applicationId).populate("job");
    if (!application) return res.status(404).json({ message: "Application not found" });

    if (!application.job || String(application.job.postedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "You are not authorized to update this application" });
    }

    application.status = newStatus;
    await application.save();

    const type = newStatus === "accepted" ? "success" : newStatus === "rejected" ? "warning" : "info";
    const msg =
      newStatus === "accepted"
        ? `Your application for "${application.job.title}" was accepted.`
        : newStatus === "rejected"
        ? `Your application for "${application.job.title}" was rejected.`
        : `Your application for "${application.job.title}" was reviewed.`;

    await notify(application.applicant, type, msg, {
      applicationId: String(application._id),
      jobId: String(application.job._id),
      newStatus,
    });

    res.json({ message: "Application status updated", application });
  } catch (error) {
    console.error("Update application status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
