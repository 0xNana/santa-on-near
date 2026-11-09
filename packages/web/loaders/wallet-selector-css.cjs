// Keep Wallet Selector's modal styles while using Santa's local font stack under its CSP.
module.exports = (css) => {
  const remoteFont = '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");';
  if (!css.startsWith(`${remoteFont}\n`)) {
    throw new Error("Review Wallet Selector CSS before changing its external font import.");
  }
  return css.slice(remoteFont.length + 1);
};
