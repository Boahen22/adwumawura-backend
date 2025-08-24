import mongoose from 'mongoose';
import Job from '../models/Job.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc Create a new job (Employer only)
// @route POST /api/jobs
// @access Private (Employer only)
export const createJob = async (req, res) => {
  try {
    const { title, description, location, salary, skillsRequired = [], category, status } = req.body;

    if (req.user.role !== 'employer') {
      return res.status(403).json({ message: 'Only employers can post jobs' });
    }

    const job = new Job({
      title,
      description,
      location,
      salary,
      skillsRequired, // schema setter will normalize to lowercase
      category,
      status,         // optional; defaults to "open"
      postedBy: req.user._id,
    });

    await job.save();

    // Notify jobseekers who match any skill
    const matchingUsers = await User.find({
      role: 'jobseeker',
      skills: { $in: job.skillsRequired },
    });

    const notifications = matchingUsers.map((user) => ({
      recipient: user._id,
      type: 'info',
      message: `A new job titled "${job.title}" matches your skills.`,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({ message: 'Job posted successfully', job });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get all jobs with optional filters and keyword search
// @route GET /api/jobs
// @access Public
export const getAllJobs = async (req, res) => {
  try {
    // Support both ?keyword= and ?search=
    const keyword = req.query.keyword || req.query.search;
    // Support both ?location= and ?region=
    const location = req.query.location || req.query.region;
    const { minSalary, maxSalary, skills, status } = req.query;

    const query = {};

    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
      ];
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (minSalary || maxSalary) {
      query.salary = {};
      if (minSalary) query.salary.$gte = Number(minSalary);
      if (maxSalary) query.salary.$lte = Number(maxSalary);
    }

    if (skills) {
      const skillArray = String(skills)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (skillArray.length) query.skillsRequired = { $in: skillArray };
    }

    if (status) {
      query.status = new RegExp(`^${String(status)}$`, 'i'); // e.g., 'open'
    }

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      // include badge fields here
      .populate('postedBy', 'name email verificationStatus isVerified');

    res.status(200).json(jobs);
  } catch (error) {
    console.error('Get all jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Recommend jobs based on skills and other fields
// @route POST /api/jobs/recommend
// @access Private (Jobseeker only)
export const recommendJobs = async (req, res) => {
  try {
    if (req.user.role !== 'jobseeker') {
      return res.status(403).json({ message: 'Only jobseekers can receive recommendations' });
    }

    const { skills = [], keywords = [] } = req.body;

    if (!Array.isArray(skills) || !Array.isArray(keywords)) {
      return res.status(400).json({ message: 'Skills and keywords must be arrays' });
    }

    const skillPatterns = skills.map((skill) => new RegExp(skill, 'i'));
    const keywordPatterns = keywords.map((word) => new RegExp(word, 'i'));

    const query = {
      $or: [
        { skillsRequired: { $in: skillPatterns } },
        { title: { $in: keywordPatterns } },
        { description: { $in: keywordPatterns } },
        { category: { $in: keywordPatterns } },
      ],
    };

    const recommendedJobs = await Job.find(query)
      .populate('postedBy', 'name email verificationStatus isVerified');

    res.status(200).json(recommendedJobs);
  } catch (error) {
    console.error('Job recommendation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get current employer's jobs
// @route GET /api/jobs/mine
// @access Private (Employer only)
export const getEmployerJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id })
      .sort({ createdAt: -1 })
      // include badge fields here
      .populate('postedBy', 'name email verificationStatus isVerified');
    res.status(200).json(jobs);
  } catch (error) {
    console.error('Get employer jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get a single job by ID
// @route GET /api/jobs/:id
// @access Public
export const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      // include badge fields here
      .populate('postedBy', 'name email verificationStatus isVerified');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json(job);
  } catch (error) {
    console.error('Get job by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Update a job post (also accepts status updates)
// @route PUT /api/jobs/:id
// @access Private (Employer only)
export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (!job.postedBy || job.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }

    if (Array.isArray(updates.skillsRequired)) {
      updates.skillsRequired = updates.skillsRequired
        .map((s) => String(s).trim().toLowerCase())
        .filter(Boolean);
    }

    Object.assign(job, updates);
    const updatedJob = await job.save();

    res.status(200).json(updatedJob);
  } catch (error) {
    res.status(500).json({ message: 'Error updating job', error: error.message });
  }
};

// @desc Update job status (open/closed)
// @route PATCH /api/jobs/:id/status
// @access Private (Employer only)
export const updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'closed'].includes(String(status))) {
      return res.status(400).json({ message: 'Invalid status. Use "open" or "closed".' });
    }

    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (job.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }

    job.status = status;
    await job.save();

    res.status(200).json({ message: 'Status updated', job });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Delete a job post
// @route DELETE /api/jobs/:id
// @access Private (Employer only)
export const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (job.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await Job.deleteOne({ _id: job._id });

    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting job', error: error.message });
  }
};
