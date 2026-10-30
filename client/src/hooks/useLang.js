import { useSelector } from 'react-redux';

export const useLang = () => useSelector((s) => s.language?.lang || 'en');
