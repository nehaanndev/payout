import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendInviteEmail = async (email: string, code: string) => {
    if (!process.env.SMTP_HOST) {
        console.warn("SMTP_HOST not set. Skipping email sending. Code:", code);
        return;
    }

    const mailOptions = {
        from: '"Toodl" <arun@toodl.co>',
        to: email,
        subject: 'Your Free Toodl Plus Subscription',
        text: `Here is your invite code for a free 1-year Toodl Plus subscription: ${code}\n\nRedeem it in the app settings.`,
        html: `<p>Here is your invite code for a free 1-year Toodl Plus subscription:</p><h3>${code}</h3><p>Redeem it in the app settings.</p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Invite email sent to ${email}`);
    } catch (error) {
        console.error("Error sending invite email:", error);
        throw error;
    }
};
