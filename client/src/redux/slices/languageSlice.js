import { createSlice } from '@reduxjs/toolkit';
import i18n from '../../i18n/i18n';

const initial = localStorage.getItem('kisan_lang') || 'en';

const languageSlice = createSlice({
  name: 'language',
  initialState: { lang: initial === 'hi' ? 'hi' : 'en' },
  reducers: {
    setLanguage: (state, action) => {
      const lang = action.payload === 'hi' ? 'hi' : 'en';
      state.lang = lang;
      localStorage.setItem('kisan_lang', lang);
      if (i18n?.changeLanguage) i18n.changeLanguage(lang);
      document.documentElement.lang = lang;
    },
  },
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer;
