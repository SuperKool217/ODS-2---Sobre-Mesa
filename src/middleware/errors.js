export function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'La fotografía supera el límite de 5 MB.' });
  }
  console.error(error);
  const status = Number(error.statusCode) || 500;
  res.status(status).json({
    error: status >= 500 ? 'Ocurrió un error interno.' : error.message
  });
}
