import crypto from 'crypto';
import { query, one, run, now } from '../config/db.js';
import { checkProject, need, notify, logActivity } from '../utils/helpers.js';
import { verifyProjectSeatLimit } from '../middleware/subscriptionGuard.js';
import { sendWorkspaceInvitationEmail } from '../services/email.service.js';
import config from '../config/config.js';

export const invitationController = {
  /**
   * POST /api/projects/:id/invitations
   * Sends an email invitation token to join a project.
   */
  async createInvitation(req, res) {
    const pid = parseInt(req.params.id);
    await checkProject(req.user, pid);

    const { email, role = 'Member' } = req.body;
    need({ email }, 'email');

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address provided' });
    }

    // 1. Fetch project info
    const project = await one('SELECT project_id, project_name, manager_id FROM projects WHERE project_id = ?', [pid]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 2. Check if already a member of the project
    const existingMember = await one(
      `SELECT tm.member_id FROM team_members tm
       JOIN users u ON tm.user_id = u.user_id
       WHERE tm.project_id = ? AND LOWER(u.email) = ?`,
      [pid, cleanEmail]
    );
    if (existingMember) {
      return res.status(400).json({ error: 'This user is already an active member of this project' });
    }

    // 3. Verify Project Seat Limit (Subscriptions)
    const managerId = project.manager_id || req.user.user_id || req.user.id;
    if (req.user.role !== 'Admin') {
      const seatCheck = await verifyProjectSeatLimit(pid, managerId);
      if (!seatCheck.allowed) {
        return res.status(403).json({
          error: `Seat limit reached (${seatCheck.currentCount}/${seatCheck.limit}). Please upgrade your DevFlow subscription plan to invite more team members.`,
          code: 'SEAT_LIMIT_REACHED',
          limit: seatCheck.limit,
          currentCount: seatCheck.currentCount,
        });
      }
    }

    // 4. Invalidate any existing Pending invitations for this email in this project
    await run(
      `UPDATE project_invitations SET status = 'Revoked', updated_at = ? WHERE project_id = ? AND email = ? AND status = 'Pending'`,
      [now(), pid, cleanEmail]
    );

    // 5. Generate secure cryptotoken & 7-day expiration
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const expiresAt = expiry.toISOString().slice(0, 19).replace('T', ' ');

    const inviterId = req.user.user_id || req.user.id;
    const currentTime = now();

    const result = await run(
      `INSERT INTO project_invitations (project_id, inviter_id, email, role, token, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
      [pid, inviterId, cleanEmail, role, token, expiresAt, currentTime, currentTime]
    );

    // 6. Send Invitation Email
    const clientUrl = config.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/invite/${token}`;

    try {
      await sendWorkspaceInvitationEmail({
        to: cleanEmail,
        inviterName: req.user.name || 'Your project manager',
        projectName: project.project_name,
        inviteUrl,
        role,
      });
    } catch (mailErr) {
      console.warn('⚠️ Could not send invite email:', mailErr.message);
    }

    await logActivity(req.user, pid, `invited '${cleanEmail}' to the project team as ${role}`);

    res.json({
      success: true,
      message: `Invitation successfully sent to ${cleanEmail}`,
      invitation_id: result.insertId,
      email: cleanEmail,
      role,
      expires_at: expiresAt,
      inviteUrl,
    });
  },

  /**
   * GET /api/projects/:id/invitations
   * Lists invitations for a given project.
   */
  async listInvitations(req, res) {
    const pid = parseInt(req.params.id);
    await checkProject(req.user, pid);

    const invitations = await query(
      `SELECT 
        pi.invitation_id,
        pi.project_id,
        pi.email,
        pi.role,
        pi.status,
        pi.expires_at,
        pi.created_at,
        u.name AS inviter_name
       FROM project_invitations pi
       JOIN users u ON pi.inviter_id = u.user_id
       WHERE pi.project_id = ?
       ORDER BY pi.invitation_id DESC`,
      [pid]
    );

    res.json(invitations);
  },

  /**
   * DELETE /api/projects/:id/invitations/:inviteId
   * Revokes a pending project invitation.
   */
  async revokeInvitation(req, res) {
    const pid = parseInt(req.params.id);
    const inviteId = parseInt(req.params.inviteId);
    await checkProject(req.user, pid);

    const result = await run(
      `UPDATE project_invitations 
       SET status = 'Revoked', updated_at = ?
       WHERE invitation_id = ? AND project_id = ? AND status = 'Pending'`,
      [now(), inviteId, pid]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Active pending invitation not found' });
    }

    res.json({ message: 'Invitation has been revoked' });
  },

  /**
   * GET /api/invitations/:token
   * Public or authenticated endpoint to inspect an invitation.
   */
  async verifyInvitationToken(req, res) {
    const token = req.params.token;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const invitation = await one(
      `SELECT 
        pi.invitation_id,
        pi.project_id,
        pi.email,
        pi.role,
        pi.status,
        pi.expires_at,
        p.project_name,
        p.description AS project_description,
        u.name AS inviter_name
       FROM project_invitations pi
       JOIN projects p ON pi.project_id = p.project_id
       JOIN users u ON pi.inviter_id = u.user_id
       WHERE pi.token = ?`,
      [token]
    );

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or non-existent invitation token' });
    }

    const isExpired = new Date(invitation.expires_at) < new Date();
    if (isExpired && invitation.status === 'Pending') {
      await run(`UPDATE project_invitations SET status = 'Expired' WHERE invitation_id = ?`, [invitation.invitation_id]);
      invitation.status = 'Expired';
    }

    res.json({
      valid: invitation.status === 'Pending' && !isExpired,
      invitation: {
        id: invitation.invitation_id,
        projectName: invitation.project_name,
        projectDescription: invitation.project_description,
        inviterName: invitation.inviter_name,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expires_at,
      },
    });
  },

  /**
   * POST /api/invitations/accept
   * Accepts an invitation and adds the authenticated user to the project team.
   */
  async acceptInvitation(req, res) {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    const invitation = await one(
      `SELECT pi.*, p.project_name, p.manager_id 
       FROM project_invitations pi
       JOIN projects p ON pi.project_id = p.project_id
       WHERE pi.token = ?`,
      [token]
    );

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation token not found' });
    }

    if (invitation.status !== 'Pending') {
      return res.status(400).json({ error: `This invitation is already ${invitation.status.toLowerCase()}` });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await run(`UPDATE project_invitations SET status = 'Expired' WHERE invitation_id = ?`, [invitation.invitation_id]);
      return res.status(400).json({ error: 'This invitation has expired' });
    }

    const userId = req.user.user_id || req.user.id;

    // Verify seat limit
    if (req.user.role !== 'Admin') {
      const seatCheck = await verifyProjectSeatLimit(invitation.project_id, invitation.manager_id);
      if (!seatCheck.allowed) {
        return res.status(403).json({
          error: 'This project has reached its maximum member seat capacity for its current subscription tier.',
          code: 'SEAT_LIMIT_REACHED',
        });
      }
    }

    const currentTime = now();

    // 1. Add user to team_members
    await run(
      'INSERT IGNORE INTO team_members (user_id, project_id) VALUES (?, ?)',
      [userId, invitation.project_id]
    );

    // 2. Mark invitation as Accepted
    await run(
      `UPDATE project_invitations SET status = 'Accepted', updated_at = ? WHERE invitation_id = ?`,
      [currentTime, invitation.invitation_id]
    );

    // 3. Notify project manager
    await notify(
      invitation.manager_id,
      `${req.user.name || req.user.email} accepted the invitation to join '${invitation.project_name}'`,
      'projects'
    );

    // 4. Audit activity log
    await logActivity(req.user, invitation.project_id, `joined the project team via email invitation`);

    res.json({
      success: true,
      message: `Successfully joined ${invitation.project_name}!`,
      projectId: invitation.project_id,
      projectName: invitation.project_name,
    });
  },
};

export default invitationController;
