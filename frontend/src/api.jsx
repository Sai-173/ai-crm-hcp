import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
});

export const sendChat = (msg) =>
  API.post("/chat", null, { params: { input: msg } });

export const logForm = (data) =>
  API.post("/log", data);