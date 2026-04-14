const fs = require("fs");
const path = require("path");

exports.default = async function (context) {
  const dir = context.appOutDir;
  const toRemove = [
    "LICENSES.chromium.html",
    "vk_swiftshader.dll",
    "vulkan-1.dll",
    "vk_swiftshader_icd.json",
  ];
  for (const file of toRemove) {
    const p = path.join(dir, file);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("  Removed:", file);
    }
  }
};
