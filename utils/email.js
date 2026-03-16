const nodemailer = require("nodemailer");
const AppError = require("./appError");

const sendEmail = async (options) => {
  try {
    //1) Create a Transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    //2) Define Email Options
    const emailOptions = {
      from: "Invoice Creation System <chsubhaaan@gmail.com>",
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html,
    };

    //3)Send the Email

    await transporter.sendMail(emailOptions);
  } catch (error) {
    console.log("Error sending email:", error.message);
    return AppError("Email could not be sent", 500);
  }
};

module.exports = sendEmail;
