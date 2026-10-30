const adminOnly = (req, res, next) => {
  if (req.user && req.user.userType === 'ADMIN') {
    next();
  } else {
    res.status(403);
    throw new Error('Access denied: Admins only');
  }
};

export { adminOnly };
