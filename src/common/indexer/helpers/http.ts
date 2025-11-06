import axios from 'axios';

export const gameApiClient = axios.create({
  baseURL: 'https://secure.runescape.com/m=hiscore_oldschool_ultimate',
  timeout: 4000,
  validateStatus: () => true,
});
