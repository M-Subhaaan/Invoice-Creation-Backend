const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { generateToken } = require("../utils/generateToken");
const sendEmail = require("../utils/email");

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token) {
    return next(
      AppError("You are not logged in...Please Log in to get Access", 401),
    );
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return next(AppError("Invalid Token", 400));
  }

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      AppError("The User belonging to this token does not longer exist", 401),
    );
  }

  if (currentUser.changedPasswordAt) {
    const changedTimeStamp = Math.floor(
      currentUser.changedPasswordAt.getTime() / 1000,
    );

    if (changedTimeStamp > decoded.iat) {
      return next(
        AppError(
          "You Recently Changed Your Password. Please Login again to get access",
          401,
        ),
      );
    }
  }
  req.user = currentUser;

  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        AppError("You are not Authorized to perform this function", 403),
      );
    }
    next();
  };
};

exports.signUp = catchAsync(async (req, res, next) => {
  const email = req.body.email;

  const user = await User.findOne({ email });
  if (user) {
    return next(AppError("Email Already Exists ", 400));
  }

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: "user",
  });

  const token = generateToken(newUser._id, res);

  res.status(201).json({
    status: "Success",
    token,
    data: {
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    },
  });
});

exports.adminSignUp = catchAsync(async (req, res, next) => {
  const email = req.body.email;
  if (!req.body.secretKey) {
    return next(AppError("Please Provide Admin Secret Key", 400));
  }

  if (req.body.secretKey !== process.env.ADMIN_SECRET_KEY) {
    return next(AppError("Invalid Admin Secret Key", 403));
  }

  const user = await User.findOne({ email });
  if (user) {
    return next(AppError("Email Already Exists ", 400));
  }

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: "admin",
  });

  const token = generateToken(newUser._id, res);

  res.status(201).json({
    status: "Success",
    token,
    data: {
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  let { email, password } = req.body;

  if (!email || !password) {
    return next(AppError("Please Provide Both Email and Password", 400));
  }

  email = email.toLowerCase();

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(AppError("Wrong Email or Password", 400));
  }

  const correctPassword = await bcrypt.compare(password, user.password);

  if (!correctPassword) {
    return next(AppError("Wrong Email or Password", 400));
  }

  const token = generateToken(user._id, res);

  res.status(200).json({
    status: "Success",
    token,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

exports.forgetPassword = catchAsync(async (req, res, next) => {
  let email = req.body.email;

  if (!email) {
    return next(AppError("Please Provide an Email Address", 400));
  }

  email = email.toLowerCase();

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(
      AppError("There is no User Account with that Email Address", 400),
    );
  }

  const resetToken = await user.createResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

  const message = `Forgot Your Password?? Submit a request to reset your password to: ${resetURL}\n If you didn't forgot your password.Ignore this mail`;

  await sendEmail({
    email: user.email,
    subject: "Reset Your Password (VALID FOR 10 MIN)",
    message: message,
    html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the button below to proceed:</p>
          <a href="${resetURL}" style="background:#28a745; color:#fff; padding:10px 20px; text-decoration:none; border-radius:5px;">Reset Password</a>
          <p>If you did not request this, please ignore this email.</p>
        </div>`,
  });

  res.status(200).json({
    status: "Success",
    message: "Check Your Mail to reset the Password",
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const resetToken = req.params.token;

  const hashedtoken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedtoken,
    passwordResetTokenExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(AppError("Token is invalid or Expires", 400));
  }

  user.password = req.body.newpassword;
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  await user.save();

  const token = generateToken(user._id, res);

  res.status(200).json({
    status: "Success",
    token,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return next(AppError("Please Provide both Current and New Password", 400));
  }
  const user = await User.findOne({ email: req.user.email }).select(
    "+password",
  );

  const correctPassword = await bcrypt.compare(currentPassword, user.password);
  if (!correctPassword) {
    return next(AppError("Incorrect Current Password", 400));
  }

  user.password = newPassword;
  await user.save();

  const token = generateToken(user._id, res);

  res.status(200).json({
    status: "Success",
    token,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

exports.logout = (req, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({
    status: "Success",
    message: "Logged out Successfully",
  });
};
