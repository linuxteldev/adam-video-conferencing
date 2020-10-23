import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import createMiddleware from './conference-signal/create-middleware';
import rootReducer from './root-reducer';
import { loadState, persistState } from './storage';
import createRtcMiddleware from './webrtc/create-middleware';

const { middleware: signalrMiddleware, getConnection } = createMiddleware({
   getAccessToken: (state) => state.auth.token!.accessToken,
   url: '/signalr',
});

const { middleware: rtcMiddleware } = createRtcMiddleware(getConnection);

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

// Store persistence
function persistInLocalStorage(state: RootState): Partial<RootState> {
   return { auth: state.auth.rememberMe ? state.auth : undefined };
}

function persistInSessionStorage(state: RootState): Partial<RootState> {
   return { auth: !state.auth.rememberMe ? state.auth : undefined };
}
