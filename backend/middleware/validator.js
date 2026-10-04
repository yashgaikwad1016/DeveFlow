/**
 * DevFlow Server-Side Input Validation & Sanitization Middleware
 * 
 * Enforces strict typing, string length boundaries, numeric ranges, enum restrictions,
 * and parameterized bounds before requests reach controllers and database queries.
 */

import { validEmail, checkPassword } from '../utils/helpers.js';

// Enum definitions matching MySQL schema & business logic
export const ENUMS = {
  TASK_STATUS: ['Pending', 'In Progress', 'Completed', 'Blocked'],
  TASK_PRIORITY: ['Low', 'Medium', 'High', 'Critical', 'AI'],
  PROJECT_STATUS: ['Active', 'On Hold', 'Completed'],
  ISSUE_SEVERITY: ['Low', 'Medium', 'High', 'Critical'],
  ISSUE_STATUS: ['Open', 'In Progress', 'Resolved', 'Closed'],
  USER_ROLE: ['Admin', 'Manager', 'Member'],
};

/**
 * Validate that route parameter :id is a positive integer
 */
export function validateIntId(paramName = 'id') {
  return (req, res, next) => {
    const val = req.params[paramName];
    if (val === undefined) return next();

    const n = Number(val);
    if (!Number.isInteger(n) || n <= 0 || !/^\d+$/.test(String(val))) {
      return res.status(400).json({
        error: `Invalid ${paramName} parameter. Expected a positive integer.`
      });
    }
    next();
  };
}

/**
 * Validate user registration payload
 */
export function validateRegister(req, res, next) {
  const { username, email, password } = req.body || {};

  if (!username || typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 100) {
    return res.status(400).json({ error: 'Username must be between 2 and 100 characters' });
  }

  if (!validEmail(email)) {
    return res.status(400).json({ error: 'A valid email address (max 254 characters) is required' });
  }

  try {
    checkPassword(password);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
}

/**
 * Validate login payload
 */
export function validateLogin(req, res, next) {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !validEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Pre-check max length immediately to block bcrypt DoS payloads
  if (password.length > 128) {
    return res.status(400).json({ error: 'Password exceeds maximum permitted length of 128 characters' });
  }

  next();
}

/**
 * Validate project creation / update payload
 */
export function validateProject(isCreate = true) {
  return (req, res, next) => {
    const b = req.body || {};

    if (isCreate) {
      if (!b.project_name || typeof b.project_name !== 'string' || !b.project_name.trim()) {
        return res.status(400).json({ error: 'project_name is required' });
      }
    }

    if (b.project_name !== undefined) {
      const name = String(b.project_name).trim();
      if (name.length < 1 || name.length > 255) {
        return res.status(400).json({ error: 'project_name must be between 1 and 255 characters' });
      }
    }

    if (b.description !== undefined && b.description !== null) {
      if (String(b.description).length > 5000) {
        return res.status(400).json({ error: 'description cannot exceed 5000 characters' });
      }
    }

    if (b.status !== undefined && !ENUMS.PROJECT_STATUS.includes(b.status)) {
      return res.status(400).json({ error: `status must be one of: ${ENUMS.PROJECT_STATUS.join(', ')}` });
    }

    if (b.start_date && b.end_date && b.end_date < b.start_date) {
      return res.status(400).json({ error: 'end_date must be on or after start_date' });
    }

    next();
  };
}

/**
 * Validate task creation / update payload
 */
export function validateTask(isCreate = true) {
  return (req, res, next) => {
    const b = req.body || {};

    if (isCreate) {
      if (!b.project_id || isNaN(parseInt(b.project_id, 10)) || parseInt(b.project_id, 10) <= 0) {
        return res.status(400).json({ error: 'Valid positive project_id is required' });
      }
      if (!b.title || typeof b.title !== 'string' || !b.title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }
    }

    if (b.title !== undefined) {
      const title = String(b.title).trim();
      if (title.length < 1 || title.length > 255) {
        return res.status(400).json({ error: 'title must be between 1 and 255 characters' });
      }
    }

    if (b.description !== undefined && b.description !== null) {
      if (String(b.description).length > 5000) {
        return res.status(400).json({ error: 'description cannot exceed 5000 characters' });
      }
    }

    if (b.status !== undefined && !ENUMS.TASK_STATUS.includes(b.status)) {
      return res.status(400).json({ error: `status must be one of: ${ENUMS.TASK_STATUS.join(', ')}` });
    }

    if (b.priority !== undefined && !ENUMS.TASK_PRIORITY.includes(b.priority)) {
      return res.status(400).json({ error: `priority must be one of: ${ENUMS.TASK_PRIORITY.join(', ')}` });
    }

    if (b.complexity !== undefined) {
      const c = parseInt(b.complexity, 10);
      if (isNaN(c) || c < 1 || c > 5) {
        return res.status(400).json({ error: 'complexity must be an integer between 1 and 5' });
      }
    }

    if (b.estimated_hours !== undefined) {
      const h = parseFloat(b.estimated_hours);
      if (isNaN(h) || h < 0 || h > 1000) {
        return res.status(400).json({ error: 'estimated_hours must be between 0 and 1000' });
      }
    }

    next();
  };
}

/**
 * Validate sprint creation / update payload
 */
export function validateSprint(isCreate = true) {
  return (req, res, next) => {
    const b = req.body || {};

    if (isCreate) {
      if (!b.project_id || isNaN(parseInt(b.project_id, 10)) || parseInt(b.project_id, 10) <= 0) {
        return res.status(400).json({ error: 'Valid positive project_id is required' });
      }
      if (!b.sprint_name || typeof b.sprint_name !== 'string' || !b.sprint_name.trim()) {
        return res.status(400).json({ error: 'sprint_name is required' });
      }
      if (!b.start_date || !b.end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
    }

    if (b.sprint_name !== undefined) {
      const name = String(b.sprint_name).trim();
      if (name.length < 1 || name.length > 255) {
        return res.status(400).json({ error: 'sprint_name must be between 1 and 255 characters' });
      }
    }

    if (b.goal !== undefined && b.goal !== null) {
      if (String(b.goal).length > 5000) {
        return res.status(400).json({ error: 'goal cannot exceed 5000 characters' });
      }
    }

    if (b.start_date && b.end_date && b.end_date < b.start_date) {
      return res.status(400).json({ error: 'end_date must be on or after start_date' });
    }

    next();
  };
}

/**
 * Validate issue creation / update payload
 */
export function validateIssue(isCreate = true) {
  return (req, res, next) => {
    const b = req.body || {};

    if (isCreate) {
      if (!b.project_id || isNaN(parseInt(b.project_id, 10)) || parseInt(b.project_id, 10) <= 0) {
        return res.status(400).json({ error: 'Valid positive project_id is required' });
      }
      if (!b.title || typeof b.title !== 'string' || !b.title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }
    }

    if (b.title !== undefined) {
      const title = String(b.title).trim();
      if (title.length < 1 || title.length > 255) {
        return res.status(400).json({ error: 'title must be between 1 and 255 characters' });
      }
    }

    if (b.description !== undefined && b.description !== null) {
      if (String(b.description).length > 5000) {
        return res.status(400).json({ error: 'description cannot exceed 5000 characters' });
      }
    }

    if (b.severity !== undefined && !ENUMS.ISSUE_SEVERITY.includes(b.severity)) {
      return res.status(400).json({ error: `severity must be one of: ${ENUMS.ISSUE_SEVERITY.join(', ')}` });
    }

    if (b.status !== undefined && !ENUMS.ISSUE_STATUS.includes(b.status)) {
      return res.status(400).json({ error: `status must be one of: ${ENUMS.ISSUE_STATUS.join(', ')}` });
    }

    next();
  };
}

export default {
  validateIntId,
  validateRegister,
  validateLogin,
  validateProject,
  validateTask,
  validateSprint,
  validateIssue,
  ENUMS,
};
