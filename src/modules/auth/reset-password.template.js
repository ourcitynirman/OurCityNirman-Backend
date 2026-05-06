export const getPasswordResetEmailTemplate = (resetLink, fullName) => `
<body style="margin:0; padding:0; background:#fff7ed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 12px 40px rgba(234,88,12,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,#ea580c,#f97316); padding:30px 24px; text-align:center;">
              <h1 style="margin:0 0 5px; font-size:21px; font-weight:700; color:#ffffff; letter-spacing:0.4px;">Our City Nirman Pvt. Ltd.</h1>
              <p style="margin:0; font-size:13px; color:rgba(255,255,255,0.88);">Building Better Cities Together</p>
            </td>
          </tr>
          <tr><td style="height:4px; background:linear-gradient(90deg,#fed7aa,#f97316,#fed7aa);"></td></tr>
          <tr>
            <td style="text-align:center; padding:32px 24px 0;">
              <div style="display:inline-block; background:#fff7ed; border:2px solid #fed7aa; border-radius:50%; width:60px; height:60px; line-height:60px; font-size:28px; text-align:center;">🔐</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px 36px; text-align:center; color:#1f2937;">
              <h2 style="margin:16px 0 8px; font-size:23px; font-weight:700; color:#9a3412;">Reset Your Password</h2>
              <p style="margin:0 0 8px; font-size:15px; color:#374151;">Hello <strong>${fullName}</strong>,</p>
              <p style="margin:0 0 30px; font-size:15px; color:#6b7280; line-height:1.7;">
                We received a request to reset the password for your
                <strong style="color:#ea580c;">Our City Nirman</strong> account.
                Click the button below to set a new password.
              </p>
              <a href="${resetLink}" target="_blank" style="display:inline-block; background:linear-gradient(135deg,#ea580c,#f97316); color:#ffffff; text-decoration:none; padding:15px 40px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.4px; box-shadow:0 4px 14px rgba(234,88,12,0.45);">
                Reset My Password
              </a>
              <p style="margin:18px 0 0; font-size:13px; color:#f97316; font-weight:500;">
                ⏱ This link is valid for <strong>15 minutes only</strong>
              </p>
              <div style="margin:28px 0 0; padding:14px 18px; background:#fff7ed; border:1px solid #fed7aa; border-left:4px solid #f97316; border-radius:8px; text-align:left;">
                <p style="margin:0; font-size:13px; color:#9a3412; line-height:1.6;">
                  ⚠️ <strong>Didn't request this?</strong>
                  If you did not request a password reset, simply ignore this email — your password will remain unchanged.
                </p>
              </div>
            </td>
          </tr>
          <tr><td style="padding:0 36px;"><hr style="border:none; border-top:1px solid #ffedd5; margin:0;" /></td></tr>
          <tr>
            <td style="background:#fff7ed; padding:20px 24px; text-align:center; font-size:12px; color:#a16207; line-height:1.7;">
              <p style="margin:0 0 3px;">© 2026 <strong>Our City Nirman Pvt. Ltd.</strong> · All rights reserved</p>
              <p style="margin:0; color:#d97706;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;
