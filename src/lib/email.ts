import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.mail.us-east-1.awsapps.com',
  port: 465,
  secure: true,
  auth: {
    user: 'reece@nunezdev.com',
    pass: process.env.WORKMAIL_APP_PASSWORD,
  },
});

export async function sendWelcomeEmail(to: string, password: string) {
  const info = await transporter.sendMail({
    from: '"Refinery Scheduler" <reece@nunezdev.com>',
    to,
    subject: 'Welcome to the Scheduling System',
    html: `
      <p>Hi there,</p>
      <p>Your login credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${to}</li>
        <li><strong>Password:</strong> ${password}</li>
      </ul>
      <p><a href="https://yourapp.com/login">Log In</a></p>
    `,
  });
  console.log('Message sent: %s', info.messageId)
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl?.(info))
  return info
}
