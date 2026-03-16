const dotenv = require("dotenv");
dotenv.config();
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
