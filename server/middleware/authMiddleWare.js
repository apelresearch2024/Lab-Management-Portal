import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if (!token) {
    return res.status(401).json({ message: 'Access Denied: No Token Provided' });
  }

  try {
    const verifiedUser = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verifiedUser; 
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or Expired Token' });
  }
}

export function requireProfessor(req, res, next) {
  if (req.user && req.user.role === 'Professor') {
    next();
  } else {
    return res.status(433).json({ message: 'Forbidden: Requires Professor Privileges' });
  }
}