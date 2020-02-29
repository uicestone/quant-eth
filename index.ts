import dotenv from "dotenv";
import { inflateRaw } from "pako";
import axios from "axios";
import Trader from "./class/Trader";

import WebSocket from "ws";
import ReconnectingWebSocket from "reconnecting-websocket";

dotenv.config();

// const pClient = PublicClient();
const apiKey = process.env.API_KEY;
const secretKey = process.env.SECRET_KEY;
const passphrase = process.env.PASSPHRASE;

if (!apiKey || !secretKey || !passphrase) {
  throw "Missing api config.";
}

const wss = new ReconnectingWebSocket("wss://real.okex.com:8443/ws/v3", [], {
  WebSocket
});

const http = axios.create({
  baseURL: "https://www.okex.com/api/"
});

const t = new Trader({ lever: 20, spacing: 0.05, lot: 10 });

// http.get("swap/v3/instruments/ticker").then(res => {
//   console.log(res.data.map((i: any) => i));
// });

const startInterval = setInterval(() => {
  if (t.last) {
    t.start("SELL");
    clearInterval(startInterval);
  }
}, 3e3);

wss.addEventListener("message", ({ data: raw }) => {
  let data: any = {};
  if (typeof raw === "string") {
    data = JSON.parse(raw);
  } else {
    try {
      data = JSON.parse(inflateRaw(raw, { to: "string" }));
    } catch (err) {
      console.log(err);
    }
  }
  if (data.table === "swap/ticker") {
    t.updateLast(+data.data[0].last);
  }
  if (data.table === "swap/trade") {
    if (data.data) {
      t.updateLast(+data.data[0].price);
    }
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
  setInterval(() => {
    wss.send(JSON.stringify({ event: "ping" }));
  }, 5e3);
});

wss.addEventListener("close", () => {
  console.log("WebSocket closed, reconnecting...");
});

wss.addEventListener("error", ({ error }) => {
  console.error(error);
});
