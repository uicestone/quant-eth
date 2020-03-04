import axios from "axios";
import config from "./config";
import { HmacSHA256, enc } from "crypto-js";

const apiBase = config.apiBase;

const client = axios.create({
  baseURL: apiBase,
  headers: {
    "OK-ACCESS-KEY": config.apiKey,
    "OK-ACCESS-PASSPHRASE": config.passphrase
  }
});

client.interceptors.request.use(
  requestConfig => {
    if (requestConfig.baseURL === apiBase) {
      const timestamp = (Date.now() / 1e3).toString();
      requestConfig.headers["OK-ACCESS-TIMESTAMP"] = timestamp;
      requestConfig.headers["OK-ACCESS-SIGN"] = enc.Base64.stringify(
        HmacSHA256(
          timestamp +
            requestConfig.method?.toUpperCase() +
            "/api/" +
            requestConfig.url +
            (requestConfig.data ? JSON.stringify(requestConfig.data) : ""),
          config.secretKey
        )
      );
    }

    return requestConfig;
  },
  error => Promise.reject(error)
);

client.interceptors.response.use(
  res => {
    return res.data;
  },
  err => {
    const apiError = { code: "UNKNOWN", message: "API Error." };
    if (err.response?.data.error_message) {
      // api error log in logic code
      apiError.code = err.response.data.code;
      apiError.message = err.response.data.error_message;
    } else if (err.message) {
      // network error log here
      console.error("Network error:", err.message);
      apiError.code = err.code;
      apiError.message = err.message;
    } else {
      console.error(err);
    }
    return Promise.reject(apiError);
  }
);

export default client;
