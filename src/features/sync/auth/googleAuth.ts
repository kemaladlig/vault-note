/**
 * Auth facade. Picks the web GIS flow or the native PKCE deep-link flow at runtime.
 * Consumers import from here and stay platform-agnostic.
 */

import { Capacitor } from '@capacitor/core'

import { GOOGLE_CLIENT_ID, isAuthConfigured } from './config'
import * as native from './nativePkceAuth'
import * as web from './webGisAuth'

const impl = Capacitor.isNativePlatform() ? native : web

export { GOOGLE_CLIENT_ID, isAuthConfigured }

export const hasSession = (): boolean => impl.hasSession()
export const restoreSession = (): Promise<boolean> => impl.restoreSession()
export const signIn = (): Promise<void> => impl.signIn()
export const getAccessToken = (): Promise<string> => impl.getAccessToken()
/** Silent token for background sync: never prompts, throws when there is no session. */
export const getAccessTokenSilent = (): Promise<string> => impl.getAccessTokenSilent()
export const signOut = (): void => impl.signOut()
