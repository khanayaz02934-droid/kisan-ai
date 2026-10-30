import { createSlice } from '@reduxjs/toolkit';

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    count: 0,
  },
  reducers: {
    setCartCount: (state, action) => {
      state.count = action.payload || 0;
    },
    clearCartCount: (state) => {
      state.count = 0;
    },
  },
});

export const { setCartCount, clearCartCount } = cartSlice.actions;
export default cartSlice.reducer;
