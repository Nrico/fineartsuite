function send404(res, message, err) {
  if (err) {
    console.error(err);
  }
  res.status(404).send(message);
}

module.exports = send404;
