import nodemailer from "nodemailer";

import dotenv from 'dotenv';
dotenv.config();

// dotenv.config({ path: "/var/www/OurCityNirman/OurCityNirman-Backend/.env" });


const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
  rejectUnauthorized: false,
},
});

export const sendMail = async ({ to, subject, html, attachments = [] }) => {
  if (!to) {
    throw new Error("Recipient email (to) is required");
  }

  return await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    attachments, 
  });
};
