import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  getToken,
  setToken,
  removeToken,
  getUserName,
  getUserRole,
  getUserType,
  getUserAvatar,
  getUserEmail,
  setUserInfo,
  setUserAvatar as storeUserAvatar
} from '../services/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthTokenState] = useState(() => getToken());
  const [userName, setUserName] = useState(() => getUserName());
  const [userRole, setUserRole] = useState(() => getUserRole());
  const [userType, setUserType] = useState(() => getUserType());
  const [userAvatar, setUserAvatarState] = useState(() => getUserAvatar());
  const [userEmail, setUserEmailState] = useState(() => getUserEmail());

  const authenticated = !!authToken;
  const admin = userType === 'admin';
  const seller = userRole === 'user' || userRole === 'seller';
  const buyer = userRole === 'user' || userRole === 'buyer';

  const login = useCallback((token, user) => {
    setToken(token);
    setAuthTokenState(token);
    if (user) {
      setUserInfo(user);
      setUserName(user.name || '');
      setUserRole(user.role || 'user');
      setUserType(user.userType || 'user');
      setUserEmailState(user.email || '');
      setUserAvatarState(user.avatar || null);
    }
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setAuthTokenState(null);
    setUserName('');
    setUserRole('user');
    setUserType('user');
    setUserAvatarState(null);
    setUserEmailState('');
  }, []);

  const updateUser = useCallback((userData) => {
    setUserInfo(userData);
    if (userData.name !== undefined) setUserName(userData.name);
    if (userData.role !== undefined) setUserRole(userData.role);
    if (userData.userType !== undefined) setUserType(userData.userType);
    if (userData.email !== undefined) setUserEmailState(userData.email);
    if (userData.avatar !== undefined) setUserAvatarState(userData.avatar);
  }, []);

  const setAvatar = useCallback((avatarUrl) => {
    storeUserAvatar(avatarUrl);
    setUserAvatarState(avatarUrl);
  }, []);

  const value = useMemo(() => ({
    authenticated,
    token: authToken,
    userName,
    userRole,
    userType,
    userAvatar,
    userEmail,
    isAdmin: admin,
    isSeller: seller,
    isBuyer: buyer,
    login,
    logout,
    updateUser,
    setAvatar
  }), [authenticated, authToken, userName, userRole, userType, userAvatar, userEmail, admin, seller, buyer, login, logout, updateUser, setAvatar]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
