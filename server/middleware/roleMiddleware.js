const adminOnly = (req, res, next) => {
  // Normalised so a legacy lowercase 'admin' in an old document cannot
  // silently lock an admin out of the admin API.
  if (req.user && String(req.user.userType || '').toUpperCase() === 'ADMIN') {
    next();
  } else {
    res.status(403);
    throw new Error('Access denied: Admins only');
  }
};

export { adminOnly };
