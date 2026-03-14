const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRouter = require("./routes/authRouter");
const vendorRouter = require("./routes/vendorRouter");
const productRouter = require("./routes/productRouter");

const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorControler");
const app = express();
app.use(helmet());

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL, // React frontend origins
    credentials: true,
  }),
);

app.use("/api/v1/users", authRouter);
app.use("/api/v1/vendors", vendorRouter);
app.use("/api/v1/products", productRouter);

app.use((req, res, next) => {
  return next(
    AppError(`Unable to find ${req.originalUrl} on this Server`, 404),
  );
});

app.use(globalErrorHandler);

module.exports = app;
