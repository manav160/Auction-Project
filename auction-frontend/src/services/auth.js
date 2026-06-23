// Auth utility functions
export const setToken = (token) => {
  localStorage.setItem('token', token);
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const setUserInfo = (user) => {
  localStorage.setItem('userRole', user.role);
  localStorage.setItem('userType', user.userType || 'user');
  localStorage.setItem('userName', user.name);
  localStorage.setItem('userEmail', user.email);
};

export const getUserRole = () => {
  return localStorage.getItem('userRole');
};

export const getUserType = () => {
  return localStorage.getItem('userType') || 'user';
};

export const getUserName = () => {
  return localStorage.getItem('userName');
};

export const removeToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userType');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
};

export const isAuthenticated = () => {
  return !!getToken();
};

export const isSeller = () => {
  const role = getUserRole();
  return role === 'user' || role === 'seller';
};

export const isBuyer = () => {
  const role = getUserRole();
  return role === 'user' || role === 'buyer';
};

export const isAdmin = () => {
  return getUserType() === 'admin';
};