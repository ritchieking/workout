import { createContext, useContext } from 'react'

export const VALID_USERS = ['ritchie', 'emily'] as const
export type UserId = (typeof VALID_USERS)[number]

const UserContext = createContext<string>('ritchie')

export const UserProvider = UserContext.Provider

export function useUser(): string {
  return useContext(UserContext)
}
