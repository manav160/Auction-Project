// Auth utility & storage helpers

export const setToken = (token) => {
  localStorage.setItem('token', token);
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const setUserInfo = (user) => {
  if (user.role) localStorage.setItem('userRole', user.role);
  if (user.userType) localStorage.setItem('userType', user.userType || 'user');
  if (user.name) localStorage.setItem('userName', user.name);
  if (user.email) localStorage.setItem('userEmail', user.email);
  if (user.avatar) {
    localStorage.setItem('userAvatar', user.avatar);
  } else if (user.avatar === null) {
    localStorage.removeItem('userAvatar');
  }
};

export const getUserRole = () => localStorage.getItem('userRole') || 'user';
export const getUserType = () => localStorage.getItem('userType') || 'user';
export const getUserName = () => localStorage.getItem('userName') || '';
export const getUserEmail = () => localStorage.getItem('userEmail') || '';
export const getUserAvatar = () => localStorage.getItem('userAvatar');

export const setUserAvatar = (avatarUrl) => {
  if (avatarUrl) {
    localStorage.setItem('userAvatar', avatarUrl);
  } else {
    localStorage.removeItem('userAvatar');
  }
};

export const removeToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userType');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userAvatar');
};

export const isAuthenticated = () => !!getToken();
export const isSeller = () => getUserRole() === 'user' || getUserRole() === 'seller';
export const isBuyer = () => getUserRole() === 'user' || getUserRole() === 'buyer';
export const isAdmin = () => getUserType() === 'admin';