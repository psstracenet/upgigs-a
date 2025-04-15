const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");

  // Add a custom 'date' filter using Luxon
  eleventyConfig.addFilter("date", (value, format = "MMMM d, yyyy") => {
    return DateTime.fromISO(value).toFormat(format);
  });

  return {
    dir: {
      input: "src",
      data: "../_data",
      output: "dist",
    },
  };
};
