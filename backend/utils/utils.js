import crypto from 'crypto';

export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}


export function getOtphtml(otp) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevFlow OTP Verification</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px 20px;
            margin: 0;
        }
        .container {
            background-color: #ffffff;
            padding: 36px 32px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            text-align: center;
            max-width: 440px;
            width: 100%;
            border: 1px solid #e2e8f0;
        }
        .logo {
            font-size: 24px;
            font-weight: 800;
            color: #4f46e5;
            margin-bottom: 20px;
            letter-spacing: -0.5px;
        }
        h2 {
            font-size: 22px;
            color: #0f172a;
            margin: 0 0 10px 0;
            font-weight: 700;
        }
        .message {
            font-size: 15px;
            color: #475569;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .otp {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 8px;
            color: #4f46e5;
            background: #eef2ff;
            padding: 16px 24px;
            border-radius: 12px;
            border: 2px dashed #818cf8;
            display: inline-block;
            margin: 10px 0 24px 0;
        }
        .footer {
            font-size: 13px;
            color: #94a3b8;
            margin-top: 24px;
            border-top: 1px solid #f1f5f9;
            padding-top: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡ DevFlow</div>
        <h2>Verify Your Email</h2>
        <p class="message">Thank you for joining DevFlow. Please use the verification code below to confirm your account:</p>
        <div class="otp">${otp}</div>
        <p class="message" style="font-size: 13px; color: #64748b;">This OTP code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        <div class="footer">DevFlow Agile Workspace &middot; Automated Notification</div>
    </div>
</body>
</html>`;
}
