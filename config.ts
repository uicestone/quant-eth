import { constantCase } from "change-case";
import { argv } from "yargs";
const yargs = require("yargs");

export enum DirectionMode {
  BUY = "BUY",
  SELL = "SELL",
  AUTO = "AUTO",
  RANDOM = "RANDOM",
  BOLL = "BOLL",
  BOLL_HL = "BOLL_HL"
}

const config = {
  directionMode: DirectionMode.RANDOM, // 开仓方向模式
  lever: 20, // 杠杆
  spacing: 0.1, // 开单间距
  lot: 100, // 每笔张数
  maxOpenWorkers: 3, // 最大开单线程数
  usdPerAmount: 10, // 每张面值
  overLoss: 0.15, // 全仓止损线
  makeOffset: 0.02, // 挂单偏移量，减少挂单变吃单可能
  fund: 0, // 本金
  apiKey: "", // OKEX API 鉴权信息
  secretKey: "",
  passphrase: "",
  apiBase: "https://www.okex.com/api/",
  webSocketUrl: "wss://real.okex.com:8443/ws/v3",
  mock: true
};

initArgs();
export default config;

export function initConfig() {
  // load config from process.env
  config.mock = !!+(process.env.MOCK || 0);

  for (const key in config) {
    const envValue = process.env[constantCase(key)];
    if (envValue) {
      // @ts-ignore
      config[key] = isNaN(+envValue) ? envValue : +envValue;
    }
  }

  for (const key of [
    "directionMode",
    "lot",
    "spacing",
    "overLoss",
    "maxOpenWorkers",
    "fund"
  ]) {
    if (argv[key] !== undefined) {
      // @ts-ignore
      config[key] = argv[key];
    }
  }

  if (!config.apiKey || !config.secretKey || !config.passphrase) {
    throw "Invalid api config.";
  }

  if (!config.fund) {
    throw "Fund not configured.";
  }

  console.log("Config init:", JSON.stringify(config));
}

function initArgs() {
  yargs
    .showHelpOnFail(true)
    .option("direction-mode", {
      alias: "d",
      describe: "开仓方向，可选B|S|A|R|O",
      type: "string"
      // default: "R"
    })
    .option("lot", {
      alias: "l",
      describe: "每笔张数",
      type: "number"
      // default: 100
    })
    .option("spacing", {
      alias: "s",
      describe: "开单间距",
      type: "number"
      // default: 0.1
    })
    .option("over-loss", {
      alias: "o",
      describe: "全仓止损线",
      type: "number"
      // default: 0.15
    })
    .option("max-open-workers", {
      alias: "m",
      describe: "最大开单线程数",
      type: "number"
      // default: 3
    })
    .option("fund", {
      alias: "f",
      describe: "本金",
      type: "number"
    })
    .help();
}
