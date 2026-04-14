require("dotenv").config();

module.exports = {
  development: {
    url: process.env.DB_URL || "postgres://postgres:postgres123@localhost:5432/sentinel_mdm",
    dialect: "postgres",
  },
};
