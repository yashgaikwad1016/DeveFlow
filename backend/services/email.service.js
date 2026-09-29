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

export const sendEmail = async (to, subject, text, html) => {
  try {
    const t = getTransporter();
    const fromAddress = config.GOOGLE_USER || config.EMAIL_USER;
    const info = await t.sendMail({
      from: `"DevFlow" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`✉️ Email sent to ${to}: messageId=${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    throw error;
  }
};
