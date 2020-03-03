import axios from "axios";
import config from "./config";
import { HmacSHA256, enc } from "crypto-js";

const apiBase = "https://www.okex.com/api/";

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
  req => {
    console.error(req.response.data.error_message);
    return Promise.reject(req.response.data);
  }
);

export default client;
