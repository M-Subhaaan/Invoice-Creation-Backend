const Counter = require("../models/counterModel");

exports.getNextInvoiceNumber = async function () {
  const counter = await Counter.findOneAndUpdate(
    { name: "invoice" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `INV-${String(counter.seq).padStart(4, "0")}`;
};

exports.getNextPONumber = async function () {
  const counter = await Counter.findOneAndUpdate(
    { name: "po" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `PO-${String(counter.seq).padStart(4, "0")}`;
};
