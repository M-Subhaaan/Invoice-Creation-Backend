const applyAPIFeatures = (modelQuery, queryStr) => {
  let query = modelQuery;

  // 1) Filtering
  const queryObj = { ...queryStr };
  const excludedFields = ["page", "sort", "limit", "fields", "search"];
  excludedFields.forEach((el) => delete queryObj[el]);

  // Advanced Filtering (gte, gt, lte, lt)
  let queryStrJSON = JSON.stringify(queryObj);
  queryStrJSON = queryStrJSON.replace(
    /\b(gte|gt|lte|lt)\b/g,
    (match) => `$${match}`,
  );
  query = query.find(JSON.parse(queryStrJSON));

  // 2) Search (Custom Logic for Name/Company)
  if (queryStr.search) {
    const searchRegex = new RegExp(queryStr.search, "i"); // Case-insensitive
    query = query.find({
      $or: [{ name: searchRegex }, { companyName: searchRegex }],
    });
  }

  // 3) Sorting
  if (queryStr.sort) {
    const sortBy = queryStr.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  // 4) Field Limiting
  if (queryStr.fields) {
    const fields = queryStr.fields.split(",").join(" ");
    query = query.select(fields);
  } else {
    query = query.select("-__v");
  }

  // 5) Pagination
  const page = queryStr.page * 1 || 1;
  const limit = queryStr.limit * 1 || 10;
  const skip = (page - 1) * limit;
  query = query.skip(skip).limit(limit);

  return query;
};

module.exports = { applyAPIFeatures };
