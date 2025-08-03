function randomAvatar() {
  const id = Math.floor(Math.random() * (70 - 15 + 1)) + 15; // 15-70 inclusive
  return `https://avatar.iran.liara.run/public/${id}`;
}

module.exports = randomAvatar;

