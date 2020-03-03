import dotenv from "dotenv";
import config, { initConfig } from "./config";
dotenv.config();
initConfig();

import { inflateRaw } from "pako";
import Trader from "./class/Trader";
import WebSocket from "ws";
import ReconnectingWebSocket from "reconnecting-websocket";
import { HmacSHA256, enc } from "crypto-js";
import api from "./api";

// const pClient = PublicClient();
const wss = new ReconnectingWebSocket("wss://real.okex.com:8443/ws/v3", [], {
  WebSocket
});

const t = new Trader(
  config.directionMode,
  config.lever,
  config.spacing,
  config.lot,
  config.fund
);

(async () => {
  try {
    if (!config.mock) {
      const res: any = await api.get("swap/v3/ETH-USD-SWAP/accounts");
      const equity = +res.info.equity;
      t.fund = equity;
    }
  } catch (err) {
    console.log(err);
  }
})();

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
        args: ["swap/position:ETH-USD-SWAP", "swap/order:ETH-USD-SWAP"]
      })
    );
  } else if (data.event === "subscribe") {
    console.log("Subscribed:", data.channel);
  } else if (data.table === "swap/position") {
    t.updatePosition(data.data);
  } else if (data.table === "swap/order") {
    t.updateOrders(data.data);
  } else if (typeof data === "object") {
    console.log(data); // TODO remove multiline logs
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
  if (!config.mock) {
    const timestamp = (Date.now() / 1e3).toString();
    const sign = enc.Base64.stringify(
      HmacSHA256(timestamp + "GET/users/self/verify", config.secretKey)
    );
    wss.send(
      JSON.stringify({
        op: "login",
        args: [config.apiKey, config.passphrase, timestamp, sign]
      })
    );
  }
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
