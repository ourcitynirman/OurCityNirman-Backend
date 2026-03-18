import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendMail = async ({ to, subject, html }) => {
  if (!to) {
    throw new Error("Recipient email (to) is required");
  }

  return await transporter.sendMail({
    from: `"CityNest" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
