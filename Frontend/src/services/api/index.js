// Frontend/src/services/api/index.js
import axios from 'axios';

const fallbackApiUrl = `${window.location.protocol}//${window.location.hostname}:5000/api`;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || fallbackApiUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export default api;