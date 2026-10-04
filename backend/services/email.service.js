import nodemailer from 'nodemailer';
import config from '../config/config.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REFRESH_TOKEN) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: config.GOOGLE_USER || config.EMAIL_USER,
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        refreshToken: config.GOOGLE_REFRESH_TOKEN,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
    });
  }

  // Verify connection asynchronously
  transporter.verify((error) => {
    if (error) {
      console.warn('⚠️ Warning: Email server verification:', error.message);
    } else {
      console.log('✅ Email server is ready to send verification messages');
    }
  });

  return transporter;
}

export const sendEmail = async (to, subject, text, html, attachments = []) => {
  try {
    const t = getTransporter();
    const fromAddress = config.GOOGLE_USER || config.EMAIL_USER;
    const mailOptions = {
      from: `"DevFlow" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
    };
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }
    const info = await t.sendMail(mailOptions);
    console.log(`✉️ Email sent to ${to}: messageId=${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    // Don't crash payment verification flow if email fails; log error
    return null;
  }
};

/**
 * Sends a rich HTML payment confirmation email with the PDF receipt attached.
 */
export const sendPaymentReceiptEmail = async ({ to, userName, payment, pdfBuffer }) => {
  try {
    const currencySymbol = payment.currency === 'INR' ? '₹' : '$';
    const formattedAmount = `${currencySymbol}${parseFloat(payment.amount).toFixed(2)}`;
    const planName = payment.plan_name ? `${payment.plan_name} Plan` : 'DevFlow Subscription';
    const receiptNumber = payment.receipt_number;

    const subject = `Payment Confirmation & Receipt #${receiptNumber} - DevFlow`;
    const text = `Hi ${userName || 'there'},\n\nThank you for your payment of ${formattedAmount} for ${planName}.\nYour official tax receipt #${receiptNumber} is attached.\n\nTeam DevFlow`;

    const html = `
      <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">DevFlow</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Agile Project Management Workspace</p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 28px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #ecfdf5; color: #059669; font-weight: 600; font-size: 13px; padding: 6px 16px; border-radius: 9999px; margin-bottom: 12px; border: 1px solid #a7f3d0;">
                ✓ Payment Successful
              </div>
              <h2 style="margin: 0; font-size: 20px; color: #0f172a;">Thank you for your subscription!</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 6px;">Your workspace has been upgraded and is ready for team collaboration.</p>
            </div>

            <!-- Order Summary Card -->
            <div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Receipt Number:</td>
                  <td style="font-weight: 600; text-align: right; color: #0f172a;">${receiptNumber}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Plan Subscribed:</td>
                  <td style="font-weight: 600; text-align: right; color: #4f46e5;">${planName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Team Seats:</td>
                  <td style="font-weight: 600; text-align: right; color: #0f172a;">${payment.member_count || 1} Member(s)</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Payment Method:</td>
                  <td style="font-weight: 600; text-align: right; color: #0f172a; text-transform: uppercase;">${payment.payment_method || 'Razorpay Online'}</td>
                </tr>
                <tr style="border-top: 1px solid #cbd5e1;">
                  <td style="font-weight: 700; color: #0f172a; padding: 12px 0 0 0; font-size: 16px;">Total Paid:</td>
                  <td style="font-weight: 700; color: #4f46e5; text-align: right; padding: 12px 0 0 0; font-size: 18px;">${formattedAmount}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 24px;">
              A complete PDF copy of your tax invoice and receipt is attached to this email for your accounting records. You can also view and download all past receipts anytime in your DevFlow Settings.
            </p>

            <div style="text-align: center;">
              <a href="${config.CLIENT_URL || 'http://localhost:5173'}/dashboard" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px; display: inline-block;">
                Go to Workspace Dashboard
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 4px 0;">DevFlow Technologies • Agile Project Management</p>
            <p style="margin: 0;">If you have any questions, reach out to our team at support@devflow.app</p>
          </div>

        </div>
      </div>
    `;

    const attachments = pdfBuffer ? [
      {
        filename: `DevFlow-Receipt-${receiptNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }
    ] : [];

    return await sendEmail(to, subject, text, html, attachments);
  } catch (err) {
    console.error('❌ Failed to dispatch receipt email:', err.message);
    return null;
  }
};

/**
 * Sends a workspace project invitation email with secure token link.
 */
export const sendWorkspaceInvitationEmail = async ({ to, inviterName, projectName, inviteUrl, role }) => {
  try {
    const subject = `${inviterName || 'A team member'} invited you to join "${projectName}" on DevFlow`;
    const text = `Hi,\n\n${inviterName || 'Someone'} has invited you to collaborate on "${projectName}" on DevFlow as a ${role || 'Member'}.\n\nClick here to accept: ${inviteUrl}\n\nExpires in 7 days.\n\nTeam DevFlow`;

    const html = `
      <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">DevFlow</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Team Collaboration Invitation</p>
          </div>

          <div style="padding: 32px 28px;">
            <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a;">You've been invited to join a project!</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
              <strong>${inviterName || 'A teammate'}</strong> has invited you to collaborate on the project <strong>${projectName}</strong> as a <strong>${role || 'Member'}</strong> on DevFlow.
            </p>

            <div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 18px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Project: <strong style="color: #0f172a;">${projectName}</strong></p>
              <p style="margin: 0; font-size: 14px; color: #64748b;">Role: <strong style="color: #4f46e5; text-transform: capitalize;">${role || 'Member'}</strong></p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${inviteUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px; display: inline-block;">
                Accept Invitation & Join Project
              </a>
            </div>

            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
              This invitation link is valid for 7 days. If you weren't expecting this invitation, you can safely ignore this email.
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 18px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0;">DevFlow Agile Workspace</p>
          </div>

        </div>
      </div>
    `;

    return await sendEmail(to, subject, text, html);
  } catch (err) {
    console.error('❌ Failed to dispatch invitation email:', err.message);
    return null;
  }
};
