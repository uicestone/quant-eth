import dotenv from "dotenv";
import { inflateRaw } from "pako";
import axios from "axios";
import Trader from "./class/Trader";
import WebSocket from "ws";
import ReconnectingWebSocket from "reconnecting-websocket";
import config, { initConfig } from "./config";
import { createHmac } from "crypto";
import { HmacSHA256, enc } from "crypto-js";

dotenv.config();
initConfig();

// const pClient = PublicClient();
const wss = new ReconnectingWebSocket("wss://real.okex.com:8443/ws/v3", [], {
  WebSocket
});

const http = axios.create({
  baseURL: "https://www.okex.com/api/"
});

const {
  directionMode,
  lever,
  spacing,
  lot,
  fund,
  apiKey,
  secretKey,
  passphrase
} = config;
const t = new Trader(directionMode, lever, spacing, lot, fund);

// http.get("swap/v3/instruments/ticker").then(res => {
//   console.log(res.data.map((i: any) => i));
// });

const startInterval = setInterval(() => {
  if (t.last) {
    // t.start();
    clearInterval(startInterval);
  }
}, 3e3);

wss.addEventListener("message", ({ data: raw }) => {
  let data: any = {};
  if (typeof raw === "string") {
    data = raw;
  } else {
    try {
      data = inflateRaw(raw, { to: "string" });
    } catch (err) {
      console.error(err);
      return;
    }
  }

  try {
    data = JSON.parse(data);
  } catch (err) {
    // console.log(data);
  }

  if (data.table === "swap/ticker") {
    t.updateLast(+data.data[0].last);
  } else if (data.table === "swap/trade") {
    if (data.data) {
      t.updateLast(+data.data[0].price);
    }
  } else if (data.event === "login" && data.success === true) {
    console.log("Login success.");
    wss.send(
      JSON.stringify({
        op: "subscribe",
        args: ["swap/position:ETH-USD-SWAP"]
      })
    );
  } else if (data.event === "subscribe") {
    console.log("Subscribed:", data.channel);
  } else if (typeof data === "object") {
    console.log(data);
  }
});

wss.addEventListener("open", () => {
  console.log("WebSocket opened.");
  wss.send(
    JSON.stringify({
      op: "subscribe",
      args: ["swap/trade:ETH-USD-SWAP"]
    })
  );
  const timestamp = (Date.now() / 1e3).toString();
  const sign = enc.Base64.stringify(
    HmacSHA256(timestamp + "GET/users/self/verify", secretKey)
  );
  wss.send(
    JSON.stringify({
      op: "login",
      args: [apiKey, passphrase, timestamp, sign]
    })
  );
  setInterval(() => {
    wss.send("ping");
  }, 6e4);
});

wss.addEventListener("close", () => {
  console.log("WebSocket closed, reconnecting...");
});

wss.addEventListener("error", ({ error }) => {
  console.error(error);
});
