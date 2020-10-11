import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import createMiddleware from './conference-signal/create-middleware';
import rootReducer from './root-reducer';
import { loadState, persistState } from './storage';
import createRtcMiddleware from './webrtc/RtcManager';

const signalrMiddleware = createMiddleware({
   getAccessToken: (state) => state.auth.token!.accessToken,
   url: '/signalr',
});

const { getSoupManager, middleware: rtcMiddleware } = createRtcMiddleware();

// configure middlewares
const middlewares = [rtcMiddleware, signalrMiddleware];

// rehydrate state on app start
const initialState = loadState({});

// create store
const store = configureStore({
   reducer: rootReducer,
   middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(middlewares),
   preloadedState: initialState,
});
// const store = createStore(rootReducer, initialState, enhancer);
persistState(store, persistInLocalStorage, persistInSessionStorage);

// export store singleton instance
export default store;

export type AppThunk = ThunkAction<void, RootState, unknown, Action<string>>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export const getMediasoup = getSoupManager;

// Store persistence
function persistInLocalStorage(state: RootState): Partial<RootState> {
   return { auth: state.auth.rememberMe ? state.auth : undefined };
}

function persistInSessionStorage(state: RootState): Partial<RootState> {
   return { auth: !state.auth.rememberMe ? state.auth : undefined };
}
