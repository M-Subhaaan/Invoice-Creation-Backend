const User = require("../models/userModel");
const { applyApiFeatures } = require("../utils/applyApiFeatures");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.deleteUser = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const user = await User.findByIdAndDelete(id);
  if (!user) {
    return next(AppError("User not Found with the Provided ID", 404));
  }
  res.status(200).json({
    status: "Success",
    message: "User Deleted Successfuly",
  });
});

exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await applyApiFeatures(User.find(), req.query);
  res.status(200).json({
    status: "Success",
    results: users.length,
    data: {
      users,
    },
  });
});
