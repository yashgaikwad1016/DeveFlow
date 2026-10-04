import PDFDocument from 'pdfkit';

export class ReceiptService {
  /**
   * Generates a professional SaaS PDF receipt stream for a verified payment.
   *
   * @param {object} payment - Joined payment, user, plan, and subscription details
   * @param {stream.Writable} res - Express response stream
   */
  static generateReceiptPDF(payment, res) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `DevFlow Receipt - ${payment.receipt_number}`,
        Author: 'DevFlow Technologies',
        Subject: 'Subscription Payment Receipt',
      },
    });

    doc.pipe(res);

    // Primary Colors
    const primaryColor = '#4f46e5'; // DevFlow Indigo
    const darkSlate = '#0f172a';
    const textGray = '#475569';
    const lightBg = '#f8fafc';
    const borderColor = '#e2e8f0';

    // ── Header Section ──────────────────────────────────────────────────────────
    // Logo / Brand
    doc
      .fontSize(24)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text('DevFlow', 50, 50, { continued: true })
      .fontSize(10)
      .fillColor(textGray)
      .font('Helvetica')
      .text('  AGILE WORKSPACE', { baseline: 'bottom' });

    // Document Title
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor(darkSlate)
      .text('OFFICIAL PAYMENT RECEIPT', 300, 50, { align: 'right' });

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(textGray)
      .text(`Receipt #: ${payment.receipt_number}`, 300, 75, { align: 'right' })
      .text(`Issue Date: ${new Date(payment.payment_time || payment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 300, 90, { align: 'right' })
      .text(`Status: COMPLETED`, 300, 105, { align: 'right' });

    // Divider
    doc
      .moveTo(50, 130)
      .lineTo(545, 130)
      .lineWidth(1)
      .strokeColor(borderColor)
      .stroke();

    // ── Company & Customer Details ──────────────────────────────────────────────
    const detailsTop = 150;

    // Left Column: Billed To
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(darkSlate)
      .text('BILLED TO:', 50, detailsTop);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(textGray)
      .text(payment.user_name || 'Valued DevFlow Customer', 50, detailsTop + 16)
      .text(payment.user_email || 'customer@devflow.local', 50, detailsTop + 30);

    if (payment.designation) {
      doc.text(payment.designation, 50, detailsTop + 44);
    }

    // Right Column: Company Info
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(darkSlate)
      .text('ISSUED BY:', 350, detailsTop);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(textGray)
      .text('DevFlow Inc.', 350, detailsTop + 16)
      .text('Agile Project Management Platform', 350, detailsTop + 30)
      .text('support@devflow.app', 350, detailsTop + 44)
      .text('https://devflow.local', 350, detailsTop + 58);

    // ── Payment Details Box ─────────────────────────────────────────────────────
    const boxTop = 230;
    doc
      .rect(50, boxTop, 495, 60)
      .fillAndStroke(lightBg, borderColor);

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(darkSlate)
      .text('PAYMENT METHOD', 65, boxTop + 12)
      .text('TRANSACTION REFERENCE', 190, boxTop + 12)
      .text('RAZORPAY ORDER ID', 350, boxTop + 12);

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(textGray)
      .text((payment.payment_method || 'Online (Razorpay)').toUpperCase(), 65, boxTop + 30)
      .text(payment.razorpay_payment_id || 'N/A', 190, boxTop + 30)
      .text(payment.razorpay_order_id || 'N/A', 350, boxTop + 30);

    // ── Itemized Table ──────────────────────────────────────────────────────────
    const tableTop = 320;

    // Table Header
    doc
      .rect(50, tableTop, 495, 26)
      .fill(primaryColor);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('DESCRIPTION / SUBSCRIPTION PLAN', 65, tableTop + 8)
      .text('MEMBERS', 320, tableTop + 8, { width: 70, align: 'center' })
      .text('PERIOD', 390, tableTop + 8, { width: 60, align: 'center' })
      .text('AMOUNT', 460, tableTop + 8, { width: 75, align: 'right' });

    // Table Row
    const rowTop = tableTop + 35;
    const planName = payment.plan_name ? `${payment.plan_name} Plan` : 'DevFlow Subscription';
    const memberCount = payment.member_count || 1;
    const interval = payment.billing_interval ? `${payment.billing_interval.charAt(0).toUpperCase() + payment.billing_interval.slice(1)}` : 'Monthly';
    const formattedAmount = `${payment.currency === 'INR' ? '₹' : '$'}${parseFloat(payment.amount).toFixed(2)}`;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(darkSlate)
      .text(planName, 65, rowTop);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(textGray)
      .text(
        payment.plan_code === 'team'
          ? `Agile workspace for ${memberCount} team members ($3/member/month)`
          : `Full access to ${planName} features for agile project collaboration`,
        65,
        rowTop + 16,
        { width: 240 }
      );

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(darkSlate)
      .text(String(memberCount), 320, rowTop + 6, { width: 70, align: 'center' })
      .text(interval, 390, rowTop + 6, { width: 60, align: 'center' })
      .font('Helvetica-Bold')
      .text(formattedAmount, 460, rowTop + 6, { width: 75, align: 'right' });

    // Row Border
    doc
      .moveTo(50, rowTop + 45)
      .lineTo(545, rowTop + 45)
      .lineWidth(1)
      .strokeColor(borderColor)
      .stroke();

    // ── Summary Box ─────────────────────────────────────────────────────────────
    const summaryTop = rowTop + 65;

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(textGray)
      .text('Subtotal:', 350, summaryTop)
      .text(formattedAmount, 460, summaryTop, { width: 75, align: 'right' });

    doc
      .text('Tax / VAT (0%):', 350, summaryTop + 18)
      .text('$0.00', 460, summaryTop + 18, { width: 75, align: 'right' });

    doc
      .moveTo(350, summaryTop + 36)
      .lineTo(545, summaryTop + 36)
      .lineWidth(1)
      .strokeColor(borderColor)
      .stroke();

    // Total Paid
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text('TOTAL PAID:', 350, summaryTop + 46)
      .text(formattedAmount, 460, summaryTop + 46, { width: 75, align: 'right' });

    // ── Security & Verification Notice ──────────────────────────────────────────
    const footerTop = 640;
    doc
      .rect(50, footerTop, 495, 75)
      .fillAndStroke(lightBg, borderColor);

    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor(darkSlate)
      .text('SECURITY & COMPLIANCE VERIFICATION', 65, footerTop + 12);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(textGray)
      .text(
        'This receipt confirms electronic payment verification via Razorpay Payment Gateway. ' +
        'DevFlow adheres to PCI-DSS standards and does NOT store sensitive payment credentials, ' +
        'card numbers, or authentication secrets on internal servers. For questions regarding this ' +
        'receipt or subscription billing, contact support@devflow.app with your receipt number.',
        65,
        footerTop + 26,
        { width: 465, lineGap: 3 }
      );

    // Bottom Branding
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#94a3b8')
      .text('Thank you for choosing DevFlow to accelerate your team productivity.', 50, 750, { align: 'center' });

    doc.end();
  }
}

export default ReceiptService;
