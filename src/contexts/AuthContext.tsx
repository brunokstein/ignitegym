import { createContext, ReactNode, useState, useEffect } from 'react';

import { storageAuthTokenSave, storageAuthTokenGet, storageAuthTokenRemove } from '@storage/storageAuthToken'
import { storageUserSave, storageUserGet, storageUserRemove } from '@storage/storageUser';

import { api } from '@services/api';
import { UserDto } from '@dtos/userDTO';

export type AuthContextDataProps = {
    user: UserDto;
    updateUserProfile: (userUpdated: UserDto) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    isLoadingUserStorageData: boolean;
}

type AuthContextProviderProps = {
    children: ReactNode;
}

export const AuthContext = createContext<AuthContextDataProps>({} as AuthContextDataProps);

export function AuthContextProvider({ children }: AuthContextProviderProps) {

    const [user, setUser] = useState<UserDto>({} as UserDto);
    const [isLoadingUserStorageData, setIsLoadingUserStorageData] = useState(true);

    async function userAndTokenUpdate(userData: UserDto, token: string) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(userData);
    }

    async function storageUserAndTokenSave(userData: UserDto, token: string, refreshToken: string) {
        try {
            setIsLoadingUserStorageData(true);

            await storageUserSave(userData);
            await storageAuthTokenSave({ token, refreshToken });

        } catch (error) {
            throw error;
        } finally {
            setIsLoadingUserStorageData(false);
        }

    }

    async function signIn(email: string, password: string) {
        try {
            const { data } = await api.post('/sessions', { email, password });

            if (data.user && data.token && data.refresh_token) {
                await storageUserAndTokenSave(data.user, data.token, data.refresh_token);
                await userAndTokenUpdate(data.user, data.token);
            }
        } catch (error) {
            throw error;
        } finally {
            setIsLoadingUserStorageData(false);
        }
    }

    async function signOut() {
        try {
            setIsLoadingUserStorageData(true);

            setUser({} as UserDto);
            await storageUserRemove();
            await storageAuthTokenRemove();

        } catch (error) {
            throw error;
        } finally {
            setIsLoadingUserStorageData(false);
        }
    }

    async function updateUserProfile(userUpdated: UserDto) {
        try {
            setUser(userUpdated);
            await storageUserSave(userUpdated);
        } catch (error) {
            throw error;
        }
    }

    async function loadUserData() {
        try {
            setIsLoadingUserStorageData(true);

            const userLogged = await storageUserGet();
            const { token } = await storageAuthTokenGet();

            if (token && userLogged) {
                userAndTokenUpdate(userLogged, token);
            }

        } catch (error) {
            throw error;
        } finally {
            setIsLoadingUserStorageData(false);
        }
    }

    useEffect(() => {
        loadUserData();
    }, []);

    useEffect(() => {
        const subscribe = api.registerInterceptTokenManager(signOut);

        return () => {
            subscribe();
        }
    }, [signOut]);

    return (
        <AuthContext.Provider value={{
            user, signIn, signOut, isLoadingUserStorageData, updateUserProfile
        }}>
            {children}
        </AuthContext.Provider>
    )
}