import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { instance } from '../api/axiosInstance';
import type { InternalAxiosRequestConfig } from 'axios';

export const AuthAxiosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    const interceptor = instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (isAuthenticated) {
          try {
            const token = await getAccessTokenSilently();

            if (config.headers) {
              config.headers.set
                ? config.headers.set('Authorization', `Bearer ${token}`)
                : (config.headers['Authorization'] = `Bearer ${token}`);
            }

          } catch (error) {
            console.error('Nie udało się pobrać tokenu:', error);
          }
        }
        return config;
      }
    );

    return () => {
      instance.interceptors.request.eject(interceptor);
    };
  }, [getAccessTokenSilently, isAuthenticated]);

  return <>{children}</>;
};
