export default {
  '/api/users': {
    GET: 'user:read',
    POST: 'user:create',
    PUT: 'user:update',
    DELETE: 'user:delete',
  },
  '/api/roles': {
    GET: 'role:read',
    POST: 'role:create',
  },
  '/api/permissions': {
    GET: 'permission:read',
    POST: 'permission:create',
  },
  '/api/risk-matrix': {
    GET: 'risk-matrix:read',
  },
};
