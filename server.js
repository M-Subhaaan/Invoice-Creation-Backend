const dotenv = require("dotenv");
dotenv.config();

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

const mongoose = require("mongoose");
const app = require("./app");

mongoose
  .connect(process.env.MONGO_DB_URL)
  .then(() => console.log("DB Connected Successfuly"))
  .catch((error) => console.log("Error in Connecting DB", error));

const port = process.env.PORT;

const server = app.listen(port, () => {
  console.log(`App is running on Port ${port}...`);
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
