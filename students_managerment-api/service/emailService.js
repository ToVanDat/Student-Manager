const { Resend } = require('resend');

const resend = new Resend(
    process.env.RESEND_API_KEY
);

const sendEmail = async ({
    to,
    subject,
    html
}) => {
    const { data, error } =
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: [to],
            subject,
            html
        });

    if (error) {
        console.error(
            'RESEND ERROR:',
            error
        );

        throw new Error(
            error.message ||
            'Không thể gửi email'
        );
    }

    console.log(
        'Email sent:',
        data
    );

    return data;
};

const sendPasswordResetOtp = async (
    email,
    otp
) => {

    return sendEmail({
        to: email,

        subject:
            'Student Management - Mã OTP đặt lại mật khẩu',

        html: `
            <!DOCTYPE html>

            <html>
            <head>
                <meta charset="UTF-8">
                <title>Reset Password OTP</title>
            </head>

            <body>

                <div
                    style="
                        max-width: 600px;
                        margin: 0 auto;
                        font-family: Arial, sans-serif;
                    "
                >

                    <h2>
                        Student Management
                    </h2>

                    <p>
                        Bạn vừa yêu cầu đặt lại mật khẩu.
                    </p>

                    <p>
                        Mã OTP của bạn là:
                    </p>

                    <div
                        style="
                            font-size: 32px;
                            font-weight: bold;
                            letter-spacing: 8px;
                            margin: 20px 0;
                        "
                    >
                        ${otp}
                    </div>

                    <p>
                        Mã OTP có hiệu lực trong
                        <strong>5 phút</strong>.
                    </p>

                    <p>
                        Không chia sẻ mã OTP này
                        với bất kỳ ai.
                    </p>

                    <hr>

                    <p
                        style="
                            color: #666;
                            font-size: 12px;
                        "
                    >
                        Nếu bạn không yêu cầu
                        đặt lại mật khẩu, hãy bỏ qua email này.
                    </p>

                </div>

            </body>
            </html>
        `
    });
};
module.exports = {
    sendEmail,
    sendPasswordResetOtp
};