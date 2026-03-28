let nodemailer = require('nodemailer');

let transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "sandbox.smtp.mailtrap.io",
    port: process.env.MAIL_PORT || 2525,
    secure: process.env.MAIL_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.MAIL_USER || "your_mailtrap_user",
        pass: process.env.MAIL_PASS || "your_mailtrap_pass"
    }
});

/**
 * Gửi email thông báo tài khoản mới cho user
 * @param {string} toEmail  - Email người nhận
 * @param {string} username - Tên đăng nhập
 * @param {string} password - Mật khẩu ngẫu nhiên (bản rõ)
 */
async function sendWelcomeEmail(toEmail, username, password) {
    let mailOptions = {
        from: `"Admin System" <admin@yourdomain.com>`,
        to: toEmail,
        subject: '🎉 Tài khoản của bạn đã được tạo thành công',
        html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; padding: 40px 20px; text-align: center;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <div style="background-color: #4f46e5; padding: 30px 20px;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">Chào mừng đến với hệ thống!</h1>
                </div>
                <div style="padding: 40px 30px; text-align: left;">
                    <p style="font-size: 16px; color: #333333; margin-top: 0; line-height: 1.6;">Xin chào <strong>${username}</strong>,</p>
                    <p style="font-size: 16px; color: #555555; line-height: 1.6;">Tài khoản của bạn đã được quản trị viên cấp phát tự động. Bạn có thể sử dụng thông tin bên dưới để đăng nhập:</p>
                    
                    <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                        <p style="margin: 0 0 10px 0; font-size: 15px; color: #475569;">👤 <strong>Tên đăng nhập:</strong> ${username}</p>
                        <p style="margin: 0 0 10px 0; font-size: 15px; color: #475569;">📧 <strong>Email:</strong> ${toEmail}</p>
                        <p style="margin: 0; font-size: 15px; color: #475569;">🔑 <strong>Mật khẩu:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0f172a; letter-spacing: 1.5px;">${password}</span></p>
                    </div>

                    <p style="font-size: 14px; color: #ef4444; font-weight: 500;">⚠️ Xin lưu ý: Vui lòng đổi mật khẩu ngay trong lần đăng nhập đầu tiên để bảo vệ tài khoản.</p>
                </div>
                <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
                    <p style="font-size: 12px; color: #94a3b8; margin: 0;">Email này được gửi tự động từ hệ thống. Vui lòng không trả lời qua email này.</p>
                </div>
            </div>
        </div>
        `
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { sendWelcomeEmail };
