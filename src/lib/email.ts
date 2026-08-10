import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "abhigogireddy03@gmail.com",
    pass: process.env.GMAIL_APP_PASSWORD || "",
  },
});

export const sendEmail = async ({
  to,
  subject,
  html,
  pdfBase64,
  fileName,
}: {
  to: string;
  subject: string;
  html: string;
  pdfBase64: string;
  fileName: string;
}) => {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn("Email dispatch skipped: GMAIL_APP_PASSWORD is not set in environment variables.");
    return;
  }
  
  if (!to) {
    console.warn("Email dispatch skipped: No recipient email provided.");
    return;
  }

  // Remove the data URI prefix if it exists (e.g. "data:application/pdf;base64,")
  const base64Data = pdfBase64.replace(/^data:application\/pdf;filename=generated\.pdf;base64,/, '')
                              .replace(/^data:application\/pdf;base64,/, '');

  const mailOptions = {
    from: '"Sri Abhinaya Fertilizers" <abhigogireddy03@gmail.com>',
    to,
    subject,
    html,
    attachments: [
      {
        filename: fileName,
        content: base64Data,
        encoding: "base64",
        contentType: "application/pdf",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};
